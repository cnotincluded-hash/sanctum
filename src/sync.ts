// Rules for keeping one Sanctum account in step across the website, phones
// and the desktop app. Every saved copy of the state carries two stamps:
//   _changedAt  when it was last changed (ms since 1970)
//   _owner      the signed-in account it belongs to
// so a device can tell whether its own copy or the account's copy is newer.

export type Stamped = { _changedAt?: number; _owner?: string } & Record<string, any>;

export type StartChoice =
  | { use: "remote" } // the account's saved copy
  | { use: "local" } // this device's copy is newer (e.g. edited offline): keep it and upload it
  | { use: "fresh" }; // nothing usable here and nothing saved yet: start blank and upload

/** Decide what to show after sign-in, once the account's saved copy (or its absence) is known. */
export function chooseStart(local: Stamped | null, remote: Stamped | null, userId: string): StartChoice {
  const ownedByOther = !!local?._owner && local._owner !== userId;
  if (!remote) {
    // First sign-in for this account: upload what's here, unless it is someone else's data.
    return local && !ownedByOther ? { use: "local" } : { use: "fresh" };
  }
  const ownedHere = local?._owner === userId;
  if (ownedHere && (local!._changedAt ?? 0) > (remote._changedAt ?? 0)) return { use: "local" };
  return { use: "remote" };
}

/** True when `candidate` was changed after `current`. Unstamped copies count as oldest. */
export function isNewer(candidate: Stamped | null | undefined, current: Stamped | null | undefined): boolean {
  return (candidate?._changedAt ?? 0) > (current?._changedAt ?? 0);
}

/** Whether this device may show and edit its own copy before the account's copy has loaded. */
export function canStartOffline(local: Stamped | null, userId: string): boolean {
  return local?._owner === userId;
}
