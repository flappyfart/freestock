"use client";

import { useId, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { COUNTRIES } from "@/lib/countries";
import { assessAvailability, ISSUER_SOURCES, type AvailabilityResult } from "@/lib/launch-policy";

export function AvailabilityCheck() {
  const id = useId();
  const [residence, setResidence] = useState("");
  const [location, setLocation] = useState("");
  const [usPerson, setUsPerson] = useState("");
  const [result, setResult] = useState<AvailabilityResult | null>(null);
  const countries = COUNTRIES.map(([code, name]) => (
    <option key={code} value={code}>
      {name}
    </option>
  ));

  return (
    <div className="launch-availability">
      <p>Planned for eligible users outside the US.</p>
      <Dialog>
        <DialogTrigger className="text-button availability-trigger">
          Check planned availability <ArrowUpRight size={14} aria-hidden="true" />
        </DialogTrigger>
        <DialogContent className="freestock-dialog availability-dialog">
          <DialogTitle className="modal-title">A non-US launch.</DialogTitle>
          <DialogDescription className="modal-description">
            We’re preparing stock-token purchases for eligible users outside the US. Availability
            varies by country. For now, freestock uses practice money only.
          </DialogDescription>
          <form
            className="availability-form"
            onSubmit={(event) => {
              event.preventDefault();
              setResult(assessAvailability({ residence, location, usPerson }));
            }}
          >
            <div className="availability-countries">
              <label htmlFor={`${id}-residence`}>
                Country of residence
                <select
                  id={`${id}-residence`}
                  value={residence}
                  onChange={(event) => {
                    setResidence(event.target.value);
                    setResult(null);
                  }}
                >
                  <option value="">Select country or territory</option>
                  {countries}
                </select>
              </label>
              <label htmlFor={`${id}-location`}>
                Current location
                <select
                  id={`${id}-location`}
                  value={location}
                  onChange={(event) => {
                    setLocation(event.target.value);
                    setResult(null);
                  }}
                >
                  <option value="">Select country or territory</option>
                  {countries}
                </select>
              </label>
            </div>
            <label htmlFor={`${id}-us-person`}>
              Are you a US person, or acting for a US person’s account or benefit?
              <select
                id={`${id}-us-person`}
                value={usPerson}
                aria-describedby={`${id}-definition`}
                onChange={(event) => {
                  setUsPerson(event.target.value);
                  setResult(null);
                }}
              >
                <option value="">Select an answer</option>
                <option value="no">No</option>
                <option value="yes">Yes</option>
                <option value="unsure">I’m not sure</option>
              </select>
            </label>
            <p id={`${id}-definition`} className="availability-detail">
              “US person” follows Regulation S and is not determined by citizenship alone.{" "}
              <a href={ISSUER_SOURCES.usPerson} target="_blank" rel="noreferrer">
                Read the definition
              </a>
              .
            </p>
            <button className="primary" type="submit">
              Check availability
            </button>
            <output
              className={result ? "availability-result" : undefined}
              aria-live="polite"
              aria-atomic="true"
            >
              {result && (
                <>
                  <strong>{result.title}</strong>
                  <span>{result.message}</span>
                </>
              )}
            </output>
          </form>
          <p className="availability-detail">
            This is an informational self-check. Your answers are not sent or saved. It does not
            open an account or enable real funds.{" "}
            <a href={ISSUER_SOURCES.faq} target="_blank" rel="noreferrer">
              Issuer availability
            </a>
            {" · "}
            <a href={ISSUER_SOURCES.restrictions} target="_blank" rel="noreferrer">
              Regional restrictions
            </a>
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
