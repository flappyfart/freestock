"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { dashboardRecoveryPath } from "./wallet-connection";
export default function Page() {
  const router = useRouter();
  useEffect(() => {
    router.replace(dashboardRecoveryPath(window.location.search, window.location.hash));
  }, [router]);
  return (
    <p>
      Opening your dashboard… <Link href="/dashboard">Go to dashboard</Link>
    </p>
  );
}
