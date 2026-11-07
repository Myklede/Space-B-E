// Launch-day weather (Role 1 agent "pad" owns this file). Pure: no browser or core imports.
//
// The player no longer picks a date: the game gives a forecast for the launch day at the chosen pad (its climate),
// and the readiness poll offers HOLD (wait one more day, for a fee). A cheap weather watch may get the forecast wrong.
// spec.launch.tempC (the Cold Morning ending) comes from here.
//
// PHASE 0 STUB: still reads the old site/slot fields so nothing changes yet. The pad agent replaces the body and keeps
// the exports and the returned fields.

/**
 * weatherFor(launch, { pad, launchData }) → {
 *   day, tempC (what the poll and the ShipSpec use), forecastC, actualC (what really happens, may differ from the
 *   forecast), windKts, lightning (0..1), label (one short line), fee (launch fees that come with the weather or site),
 *   holdFee (cost of waiting one more day), site, slot (old fields, kept while presets still use them)
 * }
 */
export function weatherFor(launch, { pad = null, launchData = null } = {}) {
  const site = pad?.sites?.find((x) => x.id === launch?.site) ?? pad?.sites?.[0] ?? null;
  const slots = site?.slots ?? launchData?.slots ?? [];
  const slot = slots.find((x) => x.id === launch?.slot) ?? slots[0] ?? { id: 'mild', tempC: 15, fee: 0 };
  const tempC = slot.tempC ?? 15;
  return { day: launch?.day ?? 0, tempC, forecastC: tempC, actualC: tempC, windKts: 0, lightning: 0, label: slot.name ?? '', fee: (slot.fee ?? 0) + (site?.fee ?? 0), holdFee: 0, site, slot };
}
