// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IToken {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}
interface IVault is IToken {
    function asset() external view returns (address);
    function deposit(uint256 assets, address receiver) external returns (uint256);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256);
    function previewRedeem(uint256 shares) external view returns (uint256);
}
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn; address tokenOut; uint24 fee; address recipient;
        uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// @notice A single-owner lending account. No operator, keeper, admin or arbitrary calls.
/// @dev Holding vault shares compounds underlying returns. No principal protection guarantee.
contract FreestockYieldAccount {
    address public immutable owner;
    IToken public immutable asset;
    IVault public immutable vault;
    ISwapRouter public immutable router;
    uint256 public immutable depositCap;
    uint256 public principal;
    uint256 public totalCompounded;
    uint256 public totalSpent;
    mapping(address => bool) public stockAllowed;
    uint256 private entered = 1;

    event Deposited(uint256 assets, uint256 shares, uint256 principalAfter);
    event Withdrawn(uint256 assets, uint256 principalAfter);
    event Compounded(uint256 assets, uint256 principalAfter);
    event StockPurchased(address indexed stock, uint256 assetsSpent, uint256 tokensReceived);
    event Closed(uint256 assetsReturned);

    modifier onlyOwner() { require(msg.sender == owner, "OWNER_ONLY"); _; }
    modifier nonReentrant() { require(entered == 1, "REENTRANCY"); entered = 2; _; entered = 1; }

    constructor(address vault_, address asset_, address router_, address[] memory stocks_, uint256 cap_) {
        require(vault_ != address(0) && asset_ != address(0) && router_ != address(0), "ZERO_ADDRESS");
        require(vault_.code.length > 0 && asset_.code.length > 0 && router_.code.length > 0, "NO_CODE");
        require(IVault(vault_).asset() == asset_, "VAULT_ASSET");
        require(cap_ > 0 && stocks_.length > 0 && stocks_.length <= 6, "ACCOUNT_CONFIG");
        owner = msg.sender; vault = IVault(vault_); asset = IToken(asset_); router = ISwapRouter(router_); depositCap = cap_;
        for (uint256 i; i < stocks_.length; ++i) {
            require(stocks_[i] != asset_ && stocks_[i] != vault_ && stocks_[i].code.length > 0 && !stockAllowed[stocks_[i]], "STOCK_CONFIG");
            stockAllowed[stocks_[i]] = true;
        }
    }

    function totalAssets() public view returns (uint256) {
        return vault.previewRedeem(vault.balanceOf(address(this))) + asset.balanceOf(address(this));
    }
    function availableYield() public view returns (uint256) {
        uint256 value = totalAssets(); return value > principal ? value - principal : 0;
    }
    function deposit(uint256 amount, uint256 minShares) external onlyOwner nonReentrant returns (uint256 shares) {
        require(amount > 0 && principal + amount <= depositCap, "DEPOSIT_CAP");
        require(minShares > 0, "MIN_SHARES");
        uint256 beforeBalance = asset.balanceOf(address(this));
        _callToken(address(asset), abi.encodeCall(IToken.transferFrom, (owner, address(this), amount)));
        require(asset.balanceOf(address(this)) - beforeBalance == amount, "ASSET_TRANSFER");
        _approve(address(vault), amount);
        shares = vault.deposit(amount, address(this));
        _approve(address(vault), 0);
        require(shares >= minShares, "SHARE_SLIPPAGE");
        principal += amount;
        emit Deposited(amount, shares, principal);
    }
    function withdraw(uint256 amount, uint256 maxShares) external onlyOwner nonReentrant {
        require(amount > 0 && amount <= totalAssets(), "WITHDRAW_AMOUNT");
        uint256 idle = asset.balanceOf(address(this));
        uint256 burned;
        if (idle < amount) burned = vault.withdraw(amount - idle, address(this), address(this));
        require(burned <= maxShares, "SHARE_SLIPPAGE");
        principal = amount >= principal ? 0 : principal - amount;
        _callToken(address(asset), abi.encodeCall(IToken.transfer, (owner, amount)));
        if (vault.balanceOf(address(this)) == 0 && asset.balanceOf(address(this)) == 0) principal = 0;
        emit Withdrawn(amount, principal);
    }
    function withdrawAll(uint256 minAssets) external onlyOwner nonReentrant {
        uint256 shares = vault.balanceOf(address(this));
        if (shares > 0) vault.redeem(shares, address(this), address(this));
        uint256 amount = asset.balanceOf(address(this));
        require(amount >= minAssets, "ASSET_SLIPPAGE");
        principal = 0;
        if (amount > 0) _callToken(address(asset), abi.encodeCall(IToken.transfer, (owner, amount)));
        emit Closed(amount);
    }
    function compound(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0 && amount <= availableYield(), "YIELD_ONLY");
        principal += amount; totalCompounded += amount;
        _depositIdle();
        emit Compounded(amount, principal);
    }
    /// @notice Atomically reinvest selected gains and buy an owner-selected basket with remaining gains.
    /// @dev All swaps go through one fixed router; no arbitrary calldata or allowances. Owner signs every harvest.
    function harvest(address[] calldata stocks, uint24[] calldata fees, uint256[] calldata amounts, uint256[] calldata minimums, uint256 compoundAmount, uint256 deadline) external onlyOwner nonReentrant {
        require(block.timestamp <= deadline && deadline <= block.timestamp + 300, "DEADLINE");
        uint256 n = stocks.length;
        require(n > 0 && n <= 6 && fees.length == n && amounts.length == n && minimums.length == n, "BASKET_LENGTH");
        uint256 budget;
        for (uint256 i; i < n; ++i) {
            require(stockAllowed[stocks[i]] && amounts[i] > 0 && minimums[i] > 0, "STOCK_OR_AMOUNT");
            require(fees[i] == 100 || fees[i] == 500 || fees[i] == 3000 || fees[i] == 10000, "POOL_FEE");
            for (uint256 j; j < i; ++j) require(stocks[j] != stocks[i], "DUPLICATE_STOCK");
            budget += amounts[i];
        }
        require(budget + compoundAmount <= availableYield(), "YIELD_ONLY");
        if (compoundAmount > 0) { principal += compoundAmount; totalCompounded += compoundAmount; emit Compounded(compoundAmount, principal); }
        uint256 idle = asset.balanceOf(address(this));
        if (idle < budget) vault.withdraw(budget - idle, address(this), address(this));
        // Recheck after vault accrual and withdrawal rounding. All actions revert together if principal would be spent.
        require(totalAssets() >= principal + budget, "YIELD_CHANGED");
        for (uint256 i; i < n; ++i) {
            IToken stock = IToken(stocks[i]);
            uint256 beforeOut = stock.balanceOf(owner);
            uint256 beforeIn = asset.balanceOf(address(this));
            _approve(address(router), amounts[i]);
            router.exactInputSingle(ISwapRouter.ExactInputSingleParams(address(asset), stocks[i], fees[i], owner, amounts[i], minimums[i], 0));
            _approve(address(router), 0);
            uint256 received = stock.balanceOf(owner) - beforeOut;
            uint256 spent = beforeIn - asset.balanceOf(address(this));
            require(received >= minimums[i] && spent <= amounts[i], "SWAP_DELTA");
            totalSpent += spent;
            emit StockPurchased(stocks[i], spent, received);
        }
        require(totalAssets() >= principal, "PRINCIPAL_SPEND");
        _depositIdle();
    }
    function _depositIdle() private {
        uint256 idle = asset.balanceOf(address(this));
        if (idle > 0) { _approve(address(vault), idle); vault.deposit(idle, address(this)); _approve(address(vault), 0); }
    }
    function _approve(address spender, uint256 amount) private {
        _callToken(address(asset), abi.encodeCall(IToken.approve, (spender, 0)));
        if (amount > 0) _callToken(address(asset), abi.encodeCall(IToken.approve, (spender, amount)));
    }
    function _callToken(address token, bytes memory data) private {
        (bool ok, bytes memory returned) = token.call(data);
        require(ok && (returned.length == 0 || abi.decode(returned, (bool))), "TOKEN_CALL");
    }
}
