import { useRef, useEffect } from 'react';
import { Box, Typography, Chip } from '@mui/material';

// ── Base layout constants (designed at BASE_W = 480 CSS px) ──────────────────
const LABEL_W    = 96;
const TOTAL_W    = 48;
const LABEL_H    = 22;   // hour-number row
const TICK_H     = 14;   // header ruler strip
const HEADER_H   = LABEL_H + TICK_H;   // 36
const ROW_H      = 38;
const ROWS       = 4;
const REMARKS_H  = 100;
const BASE_W     = 480;  // reference width all constants are sized for
const MIN_W      = 280;  // minimum canvas width (fits 320 px phones)

// ── Labels ────────────────────────────────────────────────────────────────────
const HOUR_LABELS = [
  'Midnight','1','2','3','4','5','6','7','8','9','10','11',
  'Noon','1','2','3','4','5','6','7','8','9','10','11','Midnight',
];
const ROW_LABELS   = ['1. Off Duty','2. Sleeper\nBerth','3. Driving','4. On Duty\n(Not Driving)'];
const STATUS_ORDER = ['off_duty','sleeper_berth','driving','on_duty_not_driving'];

const STATUS_COLORS = {
  off_duty:            '#374151',
  sleeper_berth:       '#6d28d9',
  driving:             '#1d4ed8',
  on_duty_not_driving: '#b45309',
};
const STATUS_FILLS = {
  off_duty:            'rgba(55,  65, 81,  0.06)',
  sleeper_berth:       'rgba(109, 40, 217, 0.10)',
  driving:             'rgba(29,  78, 216, 0.11)',
  on_duty_not_driving: 'rgba(180, 83,  9,  0.11)',
};

// ── Draw ──────────────────────────────────────────────────────────────────────
function draw(canvas, logData, cssW) {
  const dpr = window.devicePixelRatio || 1;
  const sc  = Math.min(1, cssW / BASE_W);   // ≤ 1 on narrow screens

  // ── Scaled layout dimensions ─────────────────────────────────────────────
  const lW  = Math.max(58, Math.round(LABEL_W   * sc));   // left label column
  const tW  = Math.max(30, Math.round(TOTAL_W   * sc));   // right totals column
  const rH  = Math.max(28, Math.round(ROW_H     * sc));   // duty-row height
  const rmH = Math.max(54, Math.round(REMARKS_H * sc));   // remarks height
  const hdH = HEADER_H;                                    // header stays fixed
  const gW  = cssW - lW - tW;                             // 24-hr grid width
  const totH = hdH + rH * ROWS + rmH + 2;

  // ── Scaled font sizes ────────────────────────────────────────────────────
  const fHour = Math.max(6, Math.round(7   * sc));   // hour labels
  const fBold = Math.max(7, Math.round(8.5 * sc));   // row label (bold line)
  const fSub  = Math.max(6, Math.round(8   * sc));   // row label (sub-text)
  const fTot  = Math.max(8, Math.round(11  * sc));   // totals number
  const fCity = Math.max(8, Math.round(10  * sc));   // city name in remarks

  // ── Scaled line weights ──────────────────────────────────────────────────
  const statusLineW    = Math.max(2.5, 4.5 * sc);
  const connectorLineW = Math.max(1.5, 2.5 * sc);

  // Physical pixel size
  canvas.width        = cssW * dpr;
  canvas.height       = totH * dpr;
  canvas.style.width  = `${cssW}px`;
  canvas.style.height = `${totH}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // White background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cssW, totH);

  // ── Hour-number labels ───────────────────────────────────────────────────
  HOUR_LABELS.forEach((label, h) => {
    const x    = lW + (h / 24) * gW;
    const bold = h === 0 || h === 12 || h === 24;
    ctx.fillStyle  = bold ? '#111827' : '#4b5563';
    ctx.font       = `${bold ? 'bold ' : ''}${fHour}px sans-serif`;
    ctx.textAlign  = 'center';
    ctx.fillText(label, x, LABEL_H - 8);
  });

  // "Total Hours" header
  ctx.fillStyle  = '#374151';
  ctx.font       = `bold ${fHour}px sans-serif`;
  ctx.textAlign  = 'center';
  ctx.fillText('Total', cssW - tW / 2, 8);
  ctx.fillText('Hours', cssW - tW / 2, 16);

  // ── Header ruler strip ───────────────────────────────────────────────────
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(lW, LABEL_H, gW, TICK_H);

  for (let h = 0; h <= 24; h++) {
    const x      = lW + (h / 24) * gW;
    const isMid  = h === 0 || h === 24;
    const isNoon = h === 12;
    ctx.beginPath();
    ctx.strokeStyle = isMid || isNoon ? '#1f2937' : '#6b7280';
    ctx.lineWidth   = isMid || isNoon ? 1.5 : 0.8;
    ctx.moveTo(x, LABEL_H); ctx.lineTo(x, hdH);
    ctx.stroke();
    if (h < 24) {
      [1, 2, 3].forEach(q => {
        const xq  = lW + ((h + q / 4) / 24) * gW;
        const len = q === 2 ? TICK_H * 0.55 : TICK_H * 0.28;
        ctx.beginPath();
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth   = 0.5;
        ctx.moveTo(xq, LABEL_H); ctx.lineTo(xq, LABEL_H + len);
        ctx.stroke();
      });
    }
  }
  ctx.strokeStyle = '#374151'; ctx.lineWidth = 1;
  ctx.strokeRect(lW, LABEL_H, gW, TICK_H);

  // ── Duty rows ────────────────────────────────────────────────────────────
  for (let r = 0; r < ROWS; r++) {
    const rowY   = hdH + r * rH;
    const rowMid = rowY + rH / 2;

    // Row background
    ctx.fillStyle = r % 2 === 1 ? '#f9fafb' : '#ffffff';
    ctx.fillRect(0, rowY, cssW, rH);

    // Full-height vertical grid lines
    for (let h = 0; h <= 24; h++) {
      const x      = lW + (h / 24) * gW;
      const isMid  = h === 0 || h === 24;
      const isNoon = h === 12;
      ctx.beginPath();
      ctx.strokeStyle = isMid || isNoon ? '#9ca3af' : '#d1d5db';
      ctx.lineWidth   = isMid || isNoon ? 1.0 : 0.6;
      ctx.moveTo(x, rowY); ctx.lineTo(x, rowY + rH);
      ctx.stroke();
      if (h < 24) {
        [1, 2, 3].forEach(q => {
          const xq = lW + ((h + q / 4) / 24) * gW;
          ctx.beginPath();
          ctx.strokeStyle = q === 2 ? '#e2e8f0' : '#edf0f3';
          ctx.lineWidth   = 0.4;
          ctx.moveTo(xq, rowY); ctx.lineTo(xq, rowY + rH);
          ctx.stroke();
        });
      }
    }

    // Top & bottom ruler ticks (paper-log look)
    const tkFull = Math.max(5, Math.round(9 * sc));
    const tkHalf = Math.max(3, Math.round(6 * sc));
    const tkQtr  = Math.max(2, Math.round(3 * sc));
    for (let h = 0; h < 24; h++) {
      [0, 1, 2, 3].forEach(q => {
        const xq      = lW + ((h + q / 4) / 24) * gW;
        const tickLen = q === 0 ? tkFull : q === 2 ? tkHalf : tkQtr;
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth   = 0.6;
        ctx.beginPath();
        ctx.moveTo(xq, rowY); ctx.lineTo(xq, rowY + tickLen);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(xq, rowY + rH); ctx.lineTo(xq, rowY + rH - tickLen);
        ctx.stroke();
      });
    }

    // Row top border
    ctx.beginPath();
    ctx.strokeStyle = r === 0 ? '#374151' : '#6b7280';
    ctx.lineWidth   = r === 0 ? 1.5 : 0.8;
    ctx.moveTo(0, rowY); ctx.lineTo(cssW, rowY);
    ctx.stroke();

    // Row label — vertically centred, 1 or 2 lines
    const parts      = ROW_LABELS[r].split('\n');
    const lineSpacing = fBold * 1.45;
    ctx.fillStyle = '#111827'; ctx.textAlign = 'center';
    if (parts.length === 2) {
      ctx.font = `bold ${fBold}px sans-serif`;
      ctx.fillText(parts[0], lW / 2, rowMid - lineSpacing * 0.35);
      ctx.font = `${fSub}px sans-serif`;
      ctx.fillText(parts[1], lW / 2, rowMid + lineSpacing * 0.65);
    } else {
      ctx.font = `bold ${fBold}px sans-serif`;
      ctx.fillText(parts[0], lW / 2, rowMid + fBold * 0.35);
    }

    // Total hours
    const status = STATUS_ORDER[r];
    const total  = logData.totals?.[status] ?? 0;
    ctx.fillStyle = total > 0 ? STATUS_COLORS[status] : '#cbd5e1';
    ctx.font      = total > 0 ? `bold ${fTot}px sans-serif` : `${fSub}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(total.toFixed(1), cssW - tW / 2, rowMid + fTot * 0.35);
  }

  // Bottom border
  const bottomY = hdH + rH * ROWS;
  ctx.beginPath();
  ctx.strokeStyle = '#374151'; ctx.lineWidth = 1.5;
  ctx.moveTo(0, bottomY); ctx.lineTo(cssW, bottomY);
  ctx.stroke();

  // Outer box around grid area
  ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1.5;
  ctx.strokeRect(lW, hdH, gW, rH * ROWS);

  // Column dividers
  [lW, cssW - tW].forEach(x => {
    ctx.beginPath();
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1.5;
    ctx.moveTo(x, LABEL_H); ctx.lineTo(x, bottomY);
    ctx.stroke();
  });

  // ── Status fills (behind the line) ──────────────────────────────────────
  const events = [...(logData.events || [])].sort((a, b) => a.start_hour - b.start_hour);

  events.forEach(ev => {
    const ri = STATUS_ORDER.indexOf(ev.status);
    if (ri === -1) return;
    const rowY = hdH + ri * rH;
    const x1   = lW + (ev.start_hour / 24) * gW;
    const x2   = lW + (ev.end_hour   / 24) * gW;
    if (x2 - x1 < 0.5) return;
    // 34-hr restart gets a distinct purple tint so reviewers can identify it instantly
    ctx.fillStyle = ev.type === 'restart' ? 'rgba(124, 58, 237, 0.13)' : STATUS_FILLS[ev.status];
    ctx.fillRect(x1, rowY + 1, x2 - x1, rH - 2);
  });

  // ── Bold status lines ────────────────────────────────────────────────────
  events.forEach(ev => {
    const ri = STATUS_ORDER.indexOf(ev.status);
    if (ri === -1) return;
    const rowMid = hdH + ri * rH + rH / 2;
    const x1     = lW + (ev.start_hour / 24) * gW;
    const x2     = lW + (ev.end_hour   / 24) * gW;
    if (x2 - x1 < 0.5) return;
    ctx.beginPath();
    ctx.strokeStyle = STATUS_COLORS[ev.status];
    ctx.lineWidth   = statusLineW;
    ctx.lineCap     = 'butt';
    ctx.moveTo(x1, rowMid); ctx.lineTo(x2, rowMid);
    ctx.stroke();
  });

  // ── Vertical connectors between status changes ───────────────────────────
  for (let i = 0; i < events.length - 1; i++) {
    const cur  = events[i];
    const next = events[i + 1];
    if (Math.abs(cur.end_hour - next.start_hour) > 0.02) continue;
    const ri1 = STATUS_ORDER.indexOf(cur.status);
    const ri2 = STATUS_ORDER.indexOf(next.status);
    if (ri1 === -1 || ri2 === -1 || ri1 === ri2) continue;
    const x  = lW + (cur.end_hour / 24) * gW;
    const y1 = hdH + ri1 * rH + rH / 2;
    const y2 = hdH + ri2 * rH + rH / 2;
    ctx.beginPath();
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth   = connectorLineW;
    ctx.lineCap     = 'square';
    ctx.moveTo(x, y1); ctx.lineTo(x, y2);
    ctx.stroke();
  }

  // ── REMARKS row ──────────────────────────────────────────────────────────
  const remarksY = hdH + rH * ROWS;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, remarksY, cssW, rmH);

  // Top & bottom borders
  [remarksY, remarksY + rmH].forEach(y => {
    ctx.beginPath();
    ctx.strokeStyle = '#374151'; ctx.lineWidth = 1.5;
    ctx.moveTo(0, y); ctx.lineTo(cssW, y);
    ctx.stroke();
  });

  // Column dividers
  [lW, cssW - tW].forEach(x => {
    ctx.beginPath();
    ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1.5;
    ctx.moveTo(x, remarksY); ctx.lineTo(x, remarksY + rmH);
    ctx.stroke();
  });

  ctx.fillStyle  = '#374151';
  ctx.font       = `bold ${Math.max(6, Math.round(8 * sc))}px sans-serif`;
  ctx.textAlign  = 'center';
  ctx.fillText('REMARKS', lW / 2, remarksY + rmH / 2 + 3);

  // City markers (U-shaped cup + diagonal label)
  const CUP_H     = Math.round(rmH * 0.15);
  const cupTop    = remarksY + 2;
  const cupBottom = cupTop + CUP_H;

  events
    .filter(ev => ev.address && (ev.status === 'off_duty' || ev.status === 'on_duty_not_driving'))
    .forEach(ev => {
      let x1 = lW + (ev.start_hour / 24) * gW;
      let x2 = lW + (ev.end_hour   / 24) * gW;

      x1 = Math.max(x1, lW + 1);
      x2 = Math.min(x2, cssW - tW - 1);
      if (x2 - x1 < 1) return;

      const isRestart = ev.type === 'restart';

      ctx.beginPath();
      ctx.strokeStyle = isRestart ? '#7c3aed' : '#1e3a5f';
      ctx.lineWidth   = isRestart ? 2.0 : 1.5;
      ctx.moveTo(x1, cupTop);
      ctx.lineTo(x1, cupBottom);
      ctx.lineTo(x2, cupBottom);
      ctx.lineTo(x2, cupTop);
      ctx.stroke();

      const label = ev.address.split(',').slice(0, 2).join(',').trim();
      ctx.save();
      ctx.translate(x1 + 2, cupBottom + 3);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = isRestart ? '#7c3aed' : '#1e293b';
      ctx.font      = `bold ${fCity}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(label, 2, 2);
      ctx.restore();
    });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ELDLogSheet({ logData }) {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!logData || !canvasRef.current || !containerRef.current) return;

    const redraw = () => {
      const w = Math.max(containerRef.current.clientWidth, MIN_W);
      draw(canvasRef.current, logData, w);
    };

    redraw();

    const ro = new ResizeObserver(redraw);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [logData]);

  const totals      = logData?.totals || {};
  const totalOnDuty = ((totals.driving || 0) + (totals.on_duty_not_driving || 0)).toFixed(1);

  return (
    <Box>
      {/* Sheet header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1,
        bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap',
      }}>
        <Chip label={`Day ${logData?.day_number}`} size="small"
          sx={{ bgcolor: '#0f172a', color: '#fff', fontWeight: 700, fontSize: 11, height: 22 }} />
        <Typography variant="caption" fontWeight={600} color="text.secondary">
          {logData?.date}
        </Typography>

        {/* Legend */}
        <Box sx={{ display: 'flex', gap: { xs: 1, sm: 1.5 }, flexWrap: 'wrap', ml: 0.5 }}>
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 18, height: 3.5, bgcolor: color, borderRadius: 0.5, flexShrink: 0 }} />
              <Typography sx={{ fontSize: { xs: 9, sm: 10 }, color: '#64748b', whiteSpace: 'nowrap' }}>
                {status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </Typography>
            </Box>
          ))}
        </Box>

        <Typography variant="caption" fontWeight={700} color="#0f172a" sx={{ ml: 'auto', whiteSpace: 'nowrap' }}>
          On Duty: {totalOnDuty} hr
        </Typography>
      </Box>

      {/* Canvas — containerRef measures available width; overflowX is a safety net */}
      <Box sx={{ px: { xs: 1, sm: 2 }, py: 1.5, bgcolor: '#fff', overflowX: 'auto' }}>
        <Box ref={containerRef}>
          <canvas ref={canvasRef} style={{ display: 'block' }} />
        </Box>
      </Box>
    </Box>
  );
}
