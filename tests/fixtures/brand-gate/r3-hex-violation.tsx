// Off-token hex colors and deprecated mute hex used inline.
export function EmailFooter() {
  return (
    <p style={{ color: "#8C8478", fontSize: "13px" }}>
      {/* deprecated mute color above */}
      Plaino, your service partner at agentplain
    </p>
  );
}

export function OffTokenBadge() {
  return (
    <span style={{ background: "#DEAD00", color: "#1c1917" }}>
      Status
    </span>
  );
}
