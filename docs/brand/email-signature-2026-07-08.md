# Email signature — Conner (2026-07-08)

Paste the HTML block below into the email client's signature editor (Gmail: Settings → See all settings → Signature → insert via a rendered paste — open this block in a browser first, select all, copy, paste). Inline styles only, table-based, no images — survives every client, loads instantly, and never shows a broken-image icon on a prospect's phone.

Rules applied: canonical tokens only (ink `#1A1612`, clay-deep `#97402E`, mute `#726A5E`, rule `#D8CFBA`), model vendor invisible, no title inflation, no quotes/banners/pixels.

```html
<table cellpadding="0" cellspacing="0" border="0" style="font-family: Georgia, 'Times New Roman', serif; color: #1A1612;">
  <tr>
    <td style="padding: 0 0 2px 0; font-size: 15px;">Conner Chambers</td>
  </tr>
  <tr>
    <td style="padding: 0 0 8px 0; font-family: Consolas, 'Courier New', monospace; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #726A5E;">Founder &middot; agentplain</td>
  </tr>
  <tr>
    <td style="border-top: 1px solid #D8CFBA; padding: 8px 0 0 0; font-size: 13px; line-height: 1.5;">
      <a href="https://agentplain.com" style="color: #97402E; text-decoration: none;">agentplain.com</a>
      <span style="color: #726A5E;">&nbsp;&middot;&nbsp;</span>
      <a href="mailto:hello@agentplain.com" style="color: #1A1612; text-decoration: none;">hello@agentplain.com</a>
    </td>
  </tr>
  <tr>
    <td style="padding: 4px 0 0 0; font-size: 12px; font-style: italic; color: #726A5E;">Intelligence rooted in reality.</td>
  </tr>
</table>
```

**Variant without the tagline row** (for reply chains where the signature repeats): delete the last `<tr>`. Nothing else changes.

**Why no Plaino mark:** email clients demand a hosted image URL for logos, which means a tracking-adjacent external fetch on every open and a broken icon when blocked. Type-only is faster, cleaner, and keeps the mark out of uncontrolled rendering — same reasoning as the LinkedIn banner.
