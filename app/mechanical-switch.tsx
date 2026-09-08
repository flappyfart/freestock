"use client";
import { useId } from "react";
import "./holographic-switch.css";

export function MechanicalSwitch({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="mechanical-setting">
      <div className="mechanical-label">
        <label id={`${id}-label`} htmlFor={id}>
          {label}
        </label>
        {description && <small id={`${id}-help`}>{description}</small>}
      </div>
      <button
        type="button"
        id={id}
        className="fs-holo-switch"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-help` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="fs-holo-track" aria-hidden="true">
          <span className="fs-holo-glow" />
          <span className="fs-holo-track-lines">
            <span className="fs-holo-track-line" />
          </span>
          <span className="fs-holo-data">
            <span className="fs-holo-data-text fs-holo-off">Off</span>
            <span className="fs-holo-data-text fs-holo-on">On</span>
            <span className="fs-holo-status-indicator fs-holo-off" />
            <span className="fs-holo-status-indicator fs-holo-on" />
          </span>
          <span className="fs-holo-thumb">
            <span className="fs-holo-thumb-core" />
            <span className="fs-holo-thumb-inner" />
            <span className="fs-holo-thumb-scan" />
            <span className="fs-holo-thumb-particles">
              {Array.from({ length: 5 }, (_, index) => (
                <span className="fs-holo-thumb-particle" key={index} />
              ))}
            </span>
          </span>
          <span className="fs-holo-energy-rings">
            {Array.from({ length: 3 }, (_, index) => (
              <span className="fs-holo-energy-ring" key={index} />
            ))}
          </span>
          <span className="fs-holo-reflection" />
        </span>
        <span className="fs-holo-interface-lines" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <span className="fs-holo-interface-line" key={index} />
          ))}
        </span>
      </button>
    </div>
  );
}
