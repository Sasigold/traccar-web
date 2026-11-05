// Top-down electric van, nose to the left: in the Hebrew site the trip runs
// from right to left, in reading direction. Flat, brand colors only.
const Vehicle = ({ brakeRef }) => (
  <svg className="veh" viewBox="0 0 240 124" aria-hidden="true" focusable="false">
    {/* ground contact */}
    <rect className="veh__shadow" x="10" y="16" width="232" height="104" rx="34" />
    {/* wheels */}
    <rect className="veh__wheel" x="40" y="4" width="38" height="16" rx="6" />
    <rect className="veh__wheel" x="40" y="104" width="38" height="16" rx="6" />
    <rect className="veh__wheel" x="168" y="4" width="38" height="16" rx="6" />
    <rect className="veh__wheel" x="168" y="104" width="38" height="16" rx="6" />
    {/* body */}
    <path
      className="veh__body"
      d="M52 12 H210 Q234 12 234 36 V88 Q234 112 210 112 H52 Q6 112 6 72 V52 Q6 12 52 12 Z"
    />
    {/* mirrors */}
    <rect className="veh__body" x="86" y="2" width="14" height="14" rx="5" />
    <rect className="veh__body" x="86" y="108" width="14" height="14" rx="5" />
    {/* hood seam */}
    <path className="veh__seam" d="M30 30 Q22 62 30 94" />
    {/* windshield + panoramic roof + rear glass */}
    <path className="veh__glass" d="M70 24 Q60 62 70 100 L104 94 Q97 62 104 30 Z" />
    <rect className="veh__glass" x="110" y="28" width="84" height="68" rx="14" />
    <path className="veh__glass" d="M202 32 Q208 62 202 92 L222 88 Q226 62 222 36 Z" />
    {/* roof rails */}
    <rect className="veh__rail" x="116" y="34" width="72" height="4" rx="2" />
    <rect className="veh__rail" x="116" y="86" width="72" height="4" rx="2" />
    {/* tracker unit on the roof */}
    <circle className="veh__gps-ring" cx="168" cy="62" r="11" />
    <circle className="veh__gps" cx="168" cy="62" r="5" />
    {/* light bar + headlights */}
    <rect className="veh__light" x="9" y="40" width="5" height="44" rx="2.5" />
    <rect className="veh__light" x="14" y="20" width="16" height="6" rx="3" />
    <rect className="veh__light" x="14" y="98" width="16" height="6" rx="3" />
    {/* tail lights, brighter when braking */}
    <g ref={brakeRef} className="veh__brake">
      <rect className="veh__tail" x="226" y="22" width="6" height="24" rx="3" />
      <rect className="veh__tail" x="226" y="78" width="6" height="24" rx="3" />
    </g>
  </svg>
);

export default Vehicle;
