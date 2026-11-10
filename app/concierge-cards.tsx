"use client";

import { PLACES } from "@/lib/catalog";
import type { Place } from "@/lib/places";

/** A little desktop window with a file name under it. */
export function Win({ title, file, wide, children }: { title: string; file: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <figure className={`win ${wide ? "wide" : ""}`}>
      <div className="frame">
        <div className="titlebar">
          <i />
          <i />
          <i />
          <span>{title}</span>
        </div>
        <div className="body">{children}</div>
      </div>
      <figcaption>{file}</figcaption>
    </figure>
  );
}

export function Nearby({ kind, places }: { kind: string; places: Place[] | null }) {
  const p = PLACES[kind];
  return (
    <Win wide title={p.name.toLowerCase()} file={places === null ? "searching.exa" : "nearby.exa"}>
      <ul className="places">
        {places === null && [0, 1, 2].map((i) => <li key={i} className="skeleton" />)}
        {places?.length === 0 && <li>No matching places found.</li>}
        {places?.map((pl) => (
          <li key={pl.url}>
            <a href={pl.url} target="_blank" rel="noreferrer">
              {pl.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pl.image} alt="" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
              ) : (
                <span className="thumb">{p.emoji}</span>
              )}
              <div>
                <strong>{pl.title.toLowerCase()}</strong>
                <span>{pl.blurb.toLowerCase()}</span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </Win>
  );
}
