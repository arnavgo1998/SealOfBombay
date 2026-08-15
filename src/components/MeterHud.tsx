import type { Meters } from '../game/engine';

function MeterBar({ label, value, fill }: { label: string; value: number; fill: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-center justify-between">
        <span className="truncate font-vt text-lg tracking-wide text-[#D8C7A1] uppercase">{label}</span>
      </div>
      <div className="hard-sm h-5 w-full bg-[#10161d]">
        <div className={`h-full ${fill}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

/** Slim brass tin-box readout: red pencil when the household is in debt. */
function TinBox({ rupees }: { rupees: number }) {
  const negative = rupees < 0;
  return (
    <div
      className="mt-1.5 flex items-center gap-1.5"
      title="Cash in the tin box on the desk"
    >
      {/* ₹ coin chip */}
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 font-vt text-xs leading-none ${
          negative ? 'border-[#c05a54] text-[#c05a54]' : 'border-[#9C7A3C] bg-[#9C7A3C]/30 text-[#D8C7A1]'
        }`}
      >
        ₹
      </span>
      <span
        className={`truncate font-vt text-lg tracking-wide uppercase ${
          negative ? 'text-[#c05a54]' : 'text-[#D8C7A1]'
        }`}
        style={negative ? { transform: 'rotate(-0.6deg)' } : undefined}
      >
        Tin box {negative ? '−' : ''}₹{Math.abs(rupees)}
      </span>
    </div>
  );
}

/**
 * A stamp-red docket chip telegraphing the hidden suspicion meter WITHOUT
 * ever showing its number: WATCHED at 45+, pulsing from 70, FILE OPEN at 88.
 */
function WatchedChip({ suspicion }: { suspicion: number }) {
  if (suspicion < 45) return null;
  const open = suspicion >= 88;
  const pulse = suspicion >= 70 && !open;
  return (
    <div className="mt-2 flex justify-center lg:justify-start">
      <span
        className={`inline-block border-[3px] border-[#8C2F2B] px-2 py-0.5 font-pixel text-[8px] tracking-widest text-[#8C2F2B] ${
          pulse ? 'watched-pulse' : ''
        } ${open ? 'bg-[#8C2F2B] text-[#D8C7A1]' : ''}`}
        style={{ transform: 'rotate(-2deg)' }}
        title="Someone is keeping a file on you"
      >
        {open ? 'FILE OPEN' : 'WATCHED'}
      </span>
    </div>
  );
}

/**
 * HUD with the three VISIBLE meters only, plus the tin-box cash readout
 * under the household bar. Conscience and suspicion are hidden by design
 * and must never appear here — suspicion shows only as the WATCHED docket
 * chip once the file on you is thick enough to notice. On small screens it
 * collapses to a horizontal strip of three bars; on desktop it stacks in
 * the sidebar.
 */
export function MeterHud({ meters, rupees }: { meters: Meters; rupees: number }) {
  return (
    <div className="hard bg-[#2B3A4A] p-3">
      <div className="mb-2 hidden border-b-4 border-[#1a2430] pb-1 text-center lg:block">
        <span className="font-pixel text-[9px] tracking-widest text-[#9C7A3C]">LEDGER</span>
      </div>
      <div className="flex gap-3 lg:block lg:space-y-3">
        <div className="min-w-0 flex-1">
          <MeterBar label="Household ₹" value={meters.household} fill="dither-khaki" />
          <TinBox rupees={rupees} />
        </div>
        <MeterBar label="Crown" value={meters.crown} fill="dither-red" />
        <MeterBar label="Movement" value={meters.movement} fill="dither-green" />
      </div>
      <WatchedChip suspicion={meters.suspicion} />
    </div>
  );
}
