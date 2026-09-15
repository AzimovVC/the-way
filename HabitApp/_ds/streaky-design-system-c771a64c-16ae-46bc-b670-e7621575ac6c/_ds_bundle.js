/* @ds-bundle: {"format":4,"namespace":"StreakyDesignSystem_c771a6","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Chip","sourcePath":"components/core/Chip.jsx"},{"name":"Divider","sourcePath":"components/core/Divider.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"DayPicker","sourcePath":"components/forms/DayPicker.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"SegmentedControl","sourcePath":"components/forms/SegmentedControl.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"ArtSlot","sourcePath":"components/habits/ArtSlot.jsx"},{"name":"HabitNode","sourcePath":"components/habits/HabitNode.jsx"},{"name":"HabitRow","sourcePath":"components/habits/HabitRow.jsx"},{"name":"QuestCard","sourcePath":"components/habits/QuestCard.jsx"},{"name":"UnitBanner","sourcePath":"components/habits/UnitBanner.jsx"},{"name":"ScreenHeader","sourcePath":"components/navigation/ScreenHeader.jsx"},{"name":"TabBar","sourcePath":"components/navigation/TabBar.jsx"},{"name":"TopBar","sourcePath":"components/navigation/TopBar.jsx"},{"name":"HabitRing","sourcePath":"components/progress/HabitRing.jsx"},{"name":"MetricChip","sourcePath":"components/progress/MetricChip.jsx"},{"name":"ProgressBar","sourcePath":"components/progress/ProgressBar.jsx"},{"name":"StatTile","sourcePath":"components/progress/StatTile.jsx"},{"name":"StreakCounter","sourcePath":"components/progress/StreakCounter.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"c7029df05be5","components/core/Button.jsx":"00ac5d89f62c","components/core/Card.jsx":"4e18fb74eb5c","components/core/Chip.jsx":"3b7eec5035e8","components/core/Divider.jsx":"e28b7bc23c13","components/core/Icon.jsx":"626683259672","components/core/IconButton.jsx":"9f2ab950e386","components/feedback/Dialog.jsx":"b74603e431bc","components/feedback/EmptyState.jsx":"8528b51ea59f","components/feedback/Toast.jsx":"cca7a69f9f98","components/feedback/Tooltip.jsx":"c05ba8b4d5a5","components/forms/Checkbox.jsx":"4a88c527a100","components/forms/DayPicker.jsx":"2944e81ebca1","components/forms/Input.jsx":"fdfecf5dab44","components/forms/SegmentedControl.jsx":"13819df87888","components/forms/Switch.jsx":"c7304294b510","components/habits/ArtSlot.jsx":"2988c501245e","components/habits/HabitNode.jsx":"07d1ee332b03","components/habits/HabitRow.jsx":"3694b868621b","components/habits/QuestCard.jsx":"092f5ab1a91c","components/habits/UnitBanner.jsx":"b79acbf1030d","components/navigation/ScreenHeader.jsx":"a8d41d363d70","components/navigation/TabBar.jsx":"7e01f23eab1a","components/navigation/TopBar.jsx":"f7b6feb6873e","components/progress/HabitRing.jsx":"321adbdda6a7","components/progress/MetricChip.jsx":"e4ce5249ef4e","components/progress/ProgressBar.jsx":"111c4e872420","components/progress/StatTile.jsx":"16f377763cb7","components/progress/StreakCounter.jsx":"853d04785008","ui_kits/streaky-app/AddHabitScreen.jsx":"0d0e414cb351","ui_kits/streaky-app/AppShell.jsx":"fe5c98c05874","ui_kits/streaky-app/HabitDetailScreen.jsx":"35e620a97b8d","ui_kits/streaky-app/MoreScreen.jsx":"be986484bc04","ui_kits/streaky-app/QuestsScreen.jsx":"ecb979151e39","ui_kits/streaky-app/StatsScreen.jsx":"6714b4b9c525","ui_kits/streaky-app/TodayScreen.jsx":"eb365519d003"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.StreakyDesignSystem_c771a6 = window.StreakyDesignSystem_c771a6 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Card.jsx
try { (() => {
/* Base surface. Chunky radius, hairline border, optional plinth. */
function Card({
  children,
  tone = 'card',
  plinth,
  interactive,
  padding = 'var(--pad-card)',
  onClick,
  style
}) {
  const [down, setDown] = React.useState(false);
  const tones = {
    card: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)'
    },
    raised: {
      background: 'var(--surface-raised)',
      border: '1px solid var(--border-default)'
    },
    sunken: {
      background: 'var(--surface-sunken)',
      border: '1px solid var(--border-subtle)'
    },
    brand: {
      background: 'var(--marigold-500)',
      border: 0,
      color: 'var(--text-on-brand)'
    },
    violet: {
      background: 'var(--violet-500)',
      border: 0,
      color: '#fff'
    },
    outline: {
      background: 'transparent',
      border: '2px solid var(--border-default)'
    }
  };
  const t = tones[tone] || tones.card;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    role: onClick ? 'button' : undefined,
    onPointerDown: () => interactive && setDown(true),
    onPointerUp: () => setDown(false),
    onPointerLeave: () => setDown(false),
    style: {
      borderRadius: 'var(--r-card)',
      padding,
      position: 'relative',
      boxShadow: plinth ? `0 ${down ? 0 : 4}px 0 var(--ink-600)` : 'none',
      transform: down ? 'translateY(4px)' : 'none',
      cursor: onClick ? 'pointer' : undefined,
      transition: 'transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), border-color var(--dur-fast) linear',
      ...t,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Divider.jsx
try { (() => {
/* Rule, optionally with a centred label — Streaky's section separator. */
function Divider({
  label,
  tone = 'subtle',
  style
}) {
  const c = tone === 'strong' ? 'var(--border-default)' : 'var(--border-subtle)';
  if (!label) return /*#__PURE__*/React.createElement("hr", {
    style: {
      border: 0,
      borderTop: `1px solid ${c}`,
      margin: 'var(--s-7) 0',
      ...style
    }
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--s-5)',
      margin: 'var(--s-8) 0',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      height: 1,
      background: c
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--fw-bold) var(--fs-md)/1 var(--font-display)',
      color: 'var(--text-muted)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      height: 1,
      background: c
    }
  }));
}
Object.assign(__ds_scope, { Divider });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Divider.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
const CDN = 'https://unpkg.com/lucide-static@0.544.0/icons/';

/* Monoline glyph rendered as a CSS mask so it inherits currentColor. */
function Icon({
  name,
  size = 20,
  stroke = 2.25,
  color,
  style,
  className,
  label
}) {
  const url = `${CDN}${name}.svg`;
  return /*#__PURE__*/React.createElement("span", {
    role: label ? 'img' : 'presentation',
    "aria-label": label,
    "aria-hidden": label ? undefined : true,
    className: className,
    style: {
      display: 'inline-block',
      flex: 'none',
      width: size,
      height: size,
      background: color || 'currentColor',
      WebkitMaskImage: `url(${url})`,
      maskImage: `url(${url})`,
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
      ['--sk-icon-stroke']: stroke,
      ...style
    }
  });
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
const TONES = {
  brand: ['var(--marigold-tint)', 'var(--marigold-400)'],
  success: ['var(--teal-tint)', 'var(--teal-400)'],
  info: ['var(--cobalt-tint)', 'var(--cobalt-400)'],
  danger: ['var(--coral-tint)', 'var(--coral-400)'],
  rest: ['var(--violet-tint)', 'var(--violet-400)'],
  neutral: ['var(--surface-raised)', 'var(--text-secondary)']
};

/* Small uppercase status pill. */
function Badge({
  children,
  tone = 'neutral',
  icon,
  solid,
  style
}) {
  const [bg, fg] = TONES[tone] || TONES.neutral;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--s-2)',
      padding: '3px 10px',
      borderRadius: 'var(--r-chip)',
      background: solid ? fg : bg,
      color: solid ? 'var(--ink-950)' : fg,
      font: 'var(--text-eyebrow)',
      letterSpacing: 'var(--ls-caps)',
      textTransform: 'uppercase',
      ...style
    }
  }, icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 12
  }) : null, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  primary: {
    bg: 'var(--marigold-500)',
    fg: 'var(--text-on-brand)',
    plinth: 'var(--marigold-700)'
  },
  action: {
    bg: 'var(--coral-500)',
    fg: '#fff',
    plinth: 'var(--coral-700)'
  },
  success: {
    bg: 'var(--teal-500)',
    fg: '#08302A',
    plinth: 'var(--teal-700)'
  },
  info: {
    bg: 'var(--cobalt-500)',
    fg: '#fff',
    plinth: 'var(--cobalt-700)'
  },
  neutral: {
    bg: 'var(--surface-raised)',
    fg: 'var(--text-primary)',
    plinth: 'var(--ink-600)'
  }
};
const SIZES = {
  sm: {
    h: 'var(--h-control-sm)',
    px: 'var(--s-6)',
    fs: 'var(--fs-sm)',
    r: 'var(--r-md)',
    icon: 16,
    depth: 3
  },
  md: {
    h: 'var(--h-control)',
    px: 'var(--s-7)',
    fs: 'var(--fs-md)',
    r: 'var(--r-button)',
    icon: 20,
    depth: 4
  },
  lg: {
    h: 'var(--h-control-lg)',
    px: 'var(--s-8)',
    fs: 'var(--fs-lg)',
    r: 'var(--r-xl)',
    icon: 22,
    depth: 6
  }
};

/* Chunky plinth button: solid offset shadow that collapses on press. */
function Button({
  children,
  tone = 'primary',
  size = 'md',
  variant = 'solid',
  iconLeft,
  iconRight,
  fullWidth,
  disabled,
  loading,
  onClick,
  type = 'button',
  style,
  ...rest
}) {
  const t = TONES[tone] || TONES.primary;
  const z = SIZES[size] || SIZES.md;
  const [down, setDown] = React.useState(false);
  const ghost = variant === 'ghost';
  const outline = variant === 'outline';
  const off = disabled || loading;
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--s-4)',
    width: fullWidth ? '100%' : undefined,
    minWidth: 'var(--tap-min)',
    height: z.h,
    padding: `0 ${z.px}`,
    border: 0,
    borderRadius: z.r,
    font: `var(--fw-semibold) ${z.fs}/1 var(--font-display)`,
    letterSpacing: 'var(--ls-wide)',
    textTransform: 'uppercase',
    cursor: off ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
    transition: 'transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), background var(--dur-fast) linear, filter var(--dur-fast) linear',
    opacity: off ? 0.45 : 1
  };
  const skin = ghost ? {
    background: 'transparent',
    color: t.bg,
    boxShadow: 'none'
  } : outline ? {
    background: 'transparent',
    color: t.bg,
    boxShadow: `inset 0 0 0 2px ${t.bg}, 0 ${down || off ? 0 : z.depth}px 0 ${t.plinth}`
  } : {
    background: t.bg,
    color: t.fg,
    boxShadow: off ? 'none' : `0 ${down ? 0 : z.depth}px 0 ${t.plinth}`
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: off,
    onClick: onClick,
    onPointerDown: () => !off && setDown(true),
    onPointerUp: () => setDown(false),
    onPointerLeave: () => setDown(false),
    style: {
      ...base,
      ...skin,
      transform: down && !off ? `translateY(${z.depth}px)` : 'none',
      filter: ghost && down ? 'brightness(1.2)' : undefined,
      ...style
    }
  }, rest), loading ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "loader",
    size: z.icon
  }) : iconLeft ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconLeft,
    size: z.icon
  }) : null, children, iconRight ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight,
    size: z.icon
  }) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Chip.jsx
try { (() => {
/* Selectable filter / category token. */
function Chip({
  children,
  icon,
  selected,
  onClick,
  color = 'var(--marigold-500)',
  style
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    "aria-pressed": selected,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--s-3)',
      height: 36,
      padding: '0 var(--s-5)',
      border: 0,
      borderRadius: 'var(--r-chip)',
      background: selected ? color : 'var(--surface-raised)',
      color: selected ? 'var(--ink-950)' : 'var(--text-secondary)',
      boxShadow: selected ? 'none' : 'inset 0 0 0 1px var(--border-default)',
      font: 'var(--fw-bold) var(--fs-sm)/1 var(--font-ui)',
      cursor: 'pointer',
      transition: 'background var(--dur-fast) linear, color var(--dur-fast) linear',
      ...style
    }
  }, icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 15
  }) : null, children);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Chip.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
const SIZES = {
  sm: 36,
  md: 44,
  lg: 52
};

/* Square-ish tappable glyph. Used in top bars, rails and card corners. */
function IconButton({
  icon,
  size = 'md',
  shape = 'squircle',
  tone = 'neutral',
  active,
  badge,
  disabled,
  onClick,
  label,
  style
}) {
  const d = SIZES[size] || SIZES.md;
  const [down, setDown] = React.useState(false);
  const tones = {
    neutral: {
      bg: 'var(--surface-raised)',
      fg: 'var(--text-secondary)'
    },
    brand: {
      bg: 'var(--marigold-500)',
      fg: 'var(--text-on-brand)'
    },
    plain: {
      bg: 'transparent',
      fg: 'var(--text-secondary)'
    }
  };
  const t = tones[tone] || tones.neutral;
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": label,
    "aria-pressed": active,
    disabled: disabled,
    onClick: onClick,
    onPointerDown: () => setDown(true),
    onPointerUp: () => setDown(false),
    onPointerLeave: () => setDown(false),
    style: {
      position: 'relative',
      width: d,
      height: d,
      flex: 'none',
      border: 0,
      padding: 0,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: shape === 'circle' ? 'var(--r-full)' : 'var(--r-md)',
      background: active ? 'var(--marigold-tint)' : t.bg,
      color: active ? 'var(--marigold-500)' : t.fg,
      boxShadow: active ? 'inset 0 0 0 2px var(--marigold-500)' : 'none',
      opacity: disabled ? 0.4 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transform: down && !disabled ? 'scale(var(--press-scale))' : 'none',
      transition: 'transform var(--dur-fast) var(--ease-bounce), background var(--dur-fast) linear',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: Math.round(d * 0.48)
  }), badge ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 4,
      right: 4,
      minWidth: 8,
      height: 8,
      borderRadius: 'var(--r-full)',
      background: 'var(--color-danger)'
    }
  }) : null);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
/* Bottom sheet on mobile, centred panel on wide screens. */
function Dialog({
  open = true,
  title,
  children,
  footer,
  onClose,
  variant = 'sheet',
  style
}) {
  if (!open) return null;
  const sheet = variant === 'sheet';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 40,
      background: 'var(--surface-overlay)',
      display: 'flex',
      alignItems: sheet ? 'flex-end' : 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(3px)'
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%',
      maxWidth: sheet ? undefined : 380,
      margin: sheet ? 0 : 'var(--s-6)',
      background: 'var(--surface-card)',
      borderRadius: sheet ? 'var(--r-sheet) var(--r-sheet) 0 0' : 'var(--r-card)',
      borderTop: '1px solid var(--border-default)',
      padding: 'var(--s-8) var(--s-7) var(--s-7)',
      display: 'grid',
      gap: 'var(--s-6)',
      boxShadow: 'var(--shadow-lg)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--s-5)'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      flex: 1,
      font: 'var(--text-heading)',
      color: 'var(--text-primary)'
    }
  }, title), onClose ? /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "x",
    size: "sm",
    tone: "plain",
    label: "Close",
    onClick: onClose
  }) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-body)',
      color: 'var(--text-secondary)',
      display: 'grid',
      gap: 'var(--s-5)'
    }
  }, children), footer ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--s-4)'
    }
  }, footer) : null));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
const TONES = {
  success: {
    bg: 'var(--habit-done)',
    fg: '#08302A',
    icon: 'check'
  },
  streak: {
    bg: 'var(--metric-streak)',
    fg: '#3A1103',
    icon: 'flame'
  },
  info: {
    bg: 'var(--cobalt-500)',
    fg: '#fff',
    icon: 'info'
  },
  danger: {
    bg: 'var(--color-danger)',
    fg: '#fff',
    icon: 'triangle-alert'
  }
};

/* Celebration / confirmation banner. Floats above the tab bar. */
function Toast({
  children,
  tone = 'success',
  icon,
  onDismiss,
  style
}) {
  const t = TONES[tone] || TONES.success;
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--s-5)',
      padding: 'var(--s-5) var(--s-6)',
      borderRadius: 'var(--r-lg)',
      background: t.bg,
      color: t.fg,
      boxShadow: 'var(--shadow-lg)',
      font: 'var(--fw-bold) var(--fs-md)/1.3 var(--font-ui)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon || t.icon,
    size: 24
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, children), onDismiss ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Dismiss",
    onClick: onDismiss,
    style: {
      border: 0,
      background: 'transparent',
      color: 'inherit',
      cursor: 'pointer',
      padding: 4,
      display: 'grid'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 18
  })) : null);
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
/* Small explanatory bubble, hover or tap. */
function Tooltip({
  children,
  content,
  side = 'top',
  style
}) {
  const [open, setOpen] = React.useState(false);
  const pos = side === 'bottom' ? {
    top: 'calc(100% + 8px)'
  } : {
    bottom: 'calc(100% + 8px)'
  };
  return /*#__PURE__*/React.createElement("span", {
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
    style: {
      position: 'relative',
      display: 'inline-flex',
      ...style
    }
  }, children, open ? /*#__PURE__*/React.createElement("span", {
    role: "tooltip",
    style: {
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      ...pos,
      background: 'var(--ink-050)',
      color: 'var(--ink-900)',
      padding: '6px 10px',
      borderRadius: 'var(--r-sm)',
      font: 'var(--text-caption)',
      whiteSpace: 'nowrap',
      boxShadow: 'var(--shadow-md)',
      zIndex: 30,
      pointerEvents: 'none'
    }
  }, content) : null);
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
/* Rounded-square tick. */
function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled,
  style
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: description ? 'flex-start' : 'center',
      gap: 'var(--s-5)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: !!checked,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.checked),
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 28,
      height: 28,
      flex: 'none',
      borderRadius: 'var(--r-sm)',
      display: 'grid',
      placeItems: 'center',
      background: checked ? 'var(--marigold-500)' : 'var(--surface-sunken)',
      boxShadow: checked ? '0 2px 0 var(--marigold-700)' : 'inset 0 0 0 2px var(--border-default)',
      color: 'var(--text-on-brand)',
      transition: 'background var(--dur-fast) linear'
    }
  }, checked ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 18
  }) : null), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'grid',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-body)',
      color: 'var(--text-primary)'
    }
  }, label), description ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-caption)',
      color: 'var(--text-muted)'
    }
  }, description) : null));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/DayPicker.jsx
try { (() => {
const LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/* Seven round toggles for a habit's weekly cadence. */
function DayPicker({
  value = [],
  onChange,
  style
}) {
  const toggle = i => {
    if (!onChange) return;
    onChange(value.includes(i) ? value.filter(d => d !== i) : [...value, i].sort());
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--s-4)',
      ...style
    }
  }, LABELS.map((l, i) => {
    const on = value.includes(i);
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      "aria-pressed": on,
      "aria-label": `Day ${i + 1}`,
      onClick: () => toggle(i),
      style: {
        width: 44,
        height: 44,
        border: 0,
        borderRadius: 'var(--r-full)',
        cursor: 'pointer',
        background: on ? 'var(--marigold-500)' : 'var(--surface-sunken)',
        boxShadow: on ? '0 3px 0 var(--marigold-700)' : 'inset 0 0 0 2px var(--border-default)',
        color: on ? 'var(--text-on-brand)' : 'var(--text-muted)',
        font: 'var(--fw-bold) var(--fs-md)/1 var(--font-display)',
        transition: 'background var(--dur-fast) linear'
      }
    }, l);
  }));
}
Object.assign(__ds_scope, { DayPicker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/DayPicker.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
/* Sunken field with a chunky focus ring. */
function Input({
  label,
  value,
  onChange,
  placeholder,
  icon,
  type = 'text',
  hint,
  error,
  suffix,
  disabled,
  id,
  style
}) {
  const [focus, setFocus] = React.useState(false);
  const fid = id || `in-${label || placeholder || 'field'}`.replace(/\s+/g, '-').toLowerCase();
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--s-3)',
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: fid,
    style: {
      font: 'var(--text-label)',
      color: 'var(--text-secondary)'
    }
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--s-4)',
      height: 'var(--h-control)',
      padding: '0 var(--s-5)',
      borderRadius: 'var(--r-input)',
      background: 'var(--surface-sunken)',
      boxShadow: error ? 'inset 0 0 0 2px var(--color-danger)' : focus ? 'inset 0 0 0 2px var(--border-focus)' : 'inset 0 0 0 1px var(--border-default)',
      opacity: disabled ? 0.5 : 1,
      transition: 'box-shadow var(--dur-fast) linear'
    }
  }, icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 18,
    color: "var(--text-muted)"
  }) : null, /*#__PURE__*/React.createElement("input", {
    id: fid,
    type: type,
    value: value,
    placeholder: placeholder,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.value),
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: 0,
      outline: 0,
      background: 'transparent',
      color: 'var(--text-primary)',
      font: 'var(--text-body)'
    }
  }), suffix ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-caption)',
      color: 'var(--text-muted)'
    }
  }, suffix) : null), hint || error ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-caption)',
      color: error ? 'var(--color-danger)' : 'var(--text-muted)'
    }
  }, error || hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/SegmentedControl.jsx
try { (() => {
/* Sunken track with one raised active segment. */
function SegmentedControl({
  options = [],
  value,
  onChange,
  fullWidth = true,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: 'inline-flex',
      width: fullWidth ? '100%' : undefined,
      padding: 4,
      gap: 4,
      background: 'var(--surface-sunken)',
      borderRadius: 'var(--r-md)',
      boxShadow: 'var(--shadow-inset)',
      ...style
    }
  }, options.map(o => {
    const v = typeof o === 'string' ? o : o.value;
    const l = typeof o === 'string' ? o : o.label;
    const on = v === value;
    return /*#__PURE__*/React.createElement("button", {
      key: v,
      type: "button",
      role: "tab",
      "aria-selected": on,
      onClick: () => onChange && onChange(v),
      style: {
        flex: 1,
        height: 40,
        border: 0,
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        background: on ? 'var(--surface-raised)' : 'transparent',
        boxShadow: on ? '0 2px 0 var(--ink-600)' : 'none',
        color: on ? 'var(--text-primary)' : 'var(--text-muted)',
        font: 'var(--fw-semibold) var(--fs-sm)/1 var(--font-display)',
        transition: 'background var(--dur-fast) linear, color var(--dur-fast) linear'
      }
    }, l);
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
/* Pill toggle with a plinth knob. */
function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  style
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--s-6)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      display: 'grid',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-body)',
      color: 'var(--text-primary)'
    }
  }, label), description ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-caption)',
      color: 'var(--text-muted)'
    }
  }, description) : null), /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    role: "switch",
    checked: !!checked,
    disabled: disabled,
    onChange: e => onChange && onChange(e.target.checked),
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 56,
      height: 32,
      flex: 'none',
      borderRadius: 'var(--r-full)',
      position: 'relative',
      background: checked ? 'var(--habit-done)' : 'var(--surface-track)',
      boxShadow: checked ? 'none' : 'var(--shadow-inset)',
      transition: 'background var(--dur-base) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 3,
      left: checked ? 27 : 3,
      width: 26,
      height: 26,
      borderRadius: 'var(--r-full)',
      background: '#fff',
      boxShadow: '0 2px 0 rgba(0,0,0,.28)',
      transition: 'left var(--dur-base) var(--ease-bounce)'
    }
  })));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/habits/ArtSlot.jsx
try { (() => {
/* Reserved space for brand illustration or photography. Ships as a labelled placeholder. */
function ArtSlot({
  ratio = '16/9',
  label = 'Illustration',
  src,
  alt = '',
  tone = 'sunken',
  radius = 'var(--r-lg)',
  style
}) {
  if (src) return /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: alt,
    style: {
      width: '100%',
      aspectRatio: ratio,
      objectFit: 'cover',
      borderRadius: radius,
      display: 'block',
      ...style
    }
  });
  return /*#__PURE__*/React.createElement("div", {
    role: "img",
    "aria-label": label,
    style: {
      width: '100%',
      aspectRatio: ratio,
      borderRadius: radius,
      background: tone === 'brand' ? 'var(--marigold-tint)' : 'var(--surface-sunken)',
      border: '2px dashed var(--border-default)',
      display: 'grid',
      placeItems: 'center',
      gap: 'var(--s-3)',
      color: 'var(--text-disabled)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "image",
    size: 26
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-caption)',
      letterSpacing: 'var(--ls-wide)',
      textTransform: 'uppercase'
    }
  }, label));
}
Object.assign(__ds_scope, { ArtSlot });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/habits/ArtSlot.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
/* Nothing-here panel with a single way forward. */
function EmptyState({
  title,
  blurb,
  action,
  artLabel = 'Empty state art',
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      justifyItems: 'center',
      gap: 'var(--s-6)',
      padding: 'var(--s-10) var(--s-7)',
      textAlign: 'center',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.ArtSlot, {
    ratio: "1/1",
    label: artLabel,
    radius: "var(--r-full)",
    style: {
      width: 120
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--s-3)'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      font: 'var(--text-heading)',
      color: 'var(--text-primary)'
    }
  }, title), blurb ? /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--text-body)',
      color: 'var(--text-secondary)',
      maxWidth: '30ch'
    }
  }, blurb) : null), action);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/habits/HabitNode.jsx
try { (() => {
const STATES = {
  active: {
    bg: 'var(--habit-todo)',
    ring: 'var(--marigold-700)',
    fg: 'var(--text-on-brand)'
  },
  done: {
    bg: 'var(--habit-done)',
    ring: 'var(--teal-700)',
    fg: '#08302A'
  },
  missed: {
    bg: 'var(--habit-missed)',
    ring: 'var(--coral-700)',
    fg: '#fff'
  },
  locked: {
    bg: 'var(--habit-locked)',
    ring: 'var(--ink-700)',
    fg: 'var(--text-disabled)'
  }
};

/* The path bead: a circular plinth button placed along the day's trail. */
function HabitNode({
  icon = 'star',
  state = 'locked',
  size = 76,
  offset = 0,
  label,
  onClick,
  current,
  style
}) {
  const s = STATES[state] || STATES.locked;
  const [down, setDown] = React.useState(false);
  const d = state === 'locked' ? 6 : 8;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      justifyItems: 'center',
      gap: 'var(--s-3)',
      transform: `translateX(${offset}px)`,
      ...style
    }
  }, current ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-eyebrow)',
      letterSpacing: 'var(--ls-caps)',
      textTransform: 'uppercase',
      color: 'var(--marigold-500)',
      background: 'var(--marigold-tint)',
      padding: '4px 10px',
      borderRadius: 'var(--r-chip)'
    }
  }, "Today") : null, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": label,
    onClick: state === 'locked' ? undefined : onClick,
    onPointerDown: () => state !== 'locked' && setDown(true),
    onPointerUp: () => setDown(false),
    onPointerLeave: () => setDown(false),
    style: {
      width: size,
      height: size,
      border: 0,
      borderRadius: 'var(--r-node)',
      background: s.bg,
      color: s.fg,
      display: 'grid',
      placeItems: 'center',
      boxShadow: `0 ${down ? 0 : d}px 0 ${s.ring}${current ? ', var(--shadow-glow-brand)' : ''}`,
      transform: down ? `translateY(${d}px)` : 'none',
      cursor: state === 'locked' ? 'default' : 'pointer',
      transition: 'transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: state === 'locked' ? 'lock' : icon,
    size: Math.round(size * 0.42)
  })), label ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-caption)',
      color: state === 'locked' ? 'var(--text-disabled)' : 'var(--text-secondary)',
      maxWidth: 110,
      textAlign: 'center'
    }
  }, label) : null);
}
Object.assign(__ds_scope, { HabitNode });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/habits/HabitNode.jsx", error: String((e && e.message) || e) }); }

// components/habits/HabitRow.jsx
try { (() => {
/* List form of a habit: glyph, name, cadence, and a big check affordance. */
function HabitRow({
  icon = 'circle',
  name,
  meta,
  color = 'var(--marigold-500)',
  done,
  streak,
  onToggle,
  style
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Card, {
    tone: "card",
    padding: "var(--s-5) var(--s-6)",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--s-5)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 44,
      height: 44,
      flex: 'none',
      borderRadius: 'var(--r-md)',
      display: 'grid',
      placeItems: 'center',
      background: done ? 'var(--teal-tint)' : 'var(--surface-raised)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 22,
    color: done ? 'var(--habit-done)' : color
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-subheading)',
      color: 'var(--text-primary)',
      textDecoration: done ? 'line-through' : 'none',
      textDecorationColor: 'var(--text-muted)'
    }
  }, name), meta ? /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-caption)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, meta) : null), streak != null ? /*#__PURE__*/React.createElement("span", {
    className: "sk-num",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      font: 'var(--fw-semibold) var(--fs-md)/1 var(--font-display)',
      color: 'var(--metric-streak)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "flame",
    size: 16
  }), streak) : null, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-pressed": done,
    "aria-label": done ? 'Undo check-in' : 'Check in',
    onClick: onToggle,
    style: {
      width: 44,
      height: 44,
      flex: 'none',
      border: 0,
      borderRadius: 'var(--r-full)',
      background: done ? 'var(--habit-done)' : 'var(--surface-raised)',
      boxShadow: done ? '0 3px 0 var(--teal-700)' : 'inset 0 0 0 2px var(--border-default)',
      color: done ? '#08302A' : 'var(--text-muted)',
      display: 'grid',
      placeItems: 'center',
      cursor: 'pointer',
      transition: 'background var(--dur-fast) linear, box-shadow var(--dur-fast) linear'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 22
  })));
}
Object.assign(__ds_scope, { HabitRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/habits/HabitRow.jsx", error: String((e && e.message) || e) }); }

// components/habits/UnitBanner.jsx
try { (() => {
/* Sticky chapter header for the path: section label, goal name, and a side action. */
function UnitBanner({
  eyebrow,
  title,
  actionIcon = 'list',
  onAction,
  color = 'var(--teal-500)',
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'stretch',
      borderRadius: 'var(--r-lg)',
      overflow: 'hidden',
      background: color,
      boxShadow: '0 4px 0 rgba(0,0,0,.25)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: 'var(--s-5) var(--s-6)',
      display: 'grid',
      gap: 'var(--s-2)',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-eyebrow)',
      letterSpacing: 'var(--ls-caps)',
      textTransform: 'uppercase',
      color: 'rgba(0,0,0,.55)'
    }
  }, eyebrow), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-heading)',
      color: 'var(--ink-950)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, title)), onAction ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onAction,
    "aria-label": "Open guide",
    style: {
      width: 64,
      flex: 'none',
      border: 0,
      borderLeft: '1px solid rgba(0,0,0,.18)',
      background: 'transparent',
      color: 'var(--ink-950)',
      display: 'grid',
      placeItems: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: actionIcon,
    size: 26
  })) : null);
}
Object.assign(__ds_scope, { UnitBanner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/habits/UnitBanner.jsx", error: String((e && e.message) || e) }); }

// components/navigation/ScreenHeader.jsx
try { (() => {
/* Coloured hero block for secondary screens: title, blurb, optional art on the right. */
function ScreenHeader({
  title,
  blurb,
  color = 'var(--violet-500)',
  art = true,
  artLabel = 'Header art',
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--s-6)',
      padding: 'var(--s-8) var(--pad-screen)',
      background: color,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'grid',
      gap: 'var(--s-3)'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      font: 'var(--text-title)',
      color: '#fff'
    }
  }, title), blurb ? /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--text-body)',
      color: 'rgba(255,255,255,.88)',
      maxWidth: '22ch'
    }
  }, blurb) : null), art ? /*#__PURE__*/React.createElement(__ds_scope.ArtSlot, {
    ratio: "1/1",
    label: artLabel,
    radius: "var(--r-full)",
    tone: "sunken",
    style: {
      width: 110,
      flex: 'none',
      background: 'rgba(0,0,0,.16)',
      borderColor: 'rgba(255,255,255,.35)',
      color: 'rgba(255,255,255,.7)'
    }
  }) : null);
}
Object.assign(__ds_scope, { ScreenHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/ScreenHeader.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TabBar.jsx
try { (() => {
/* Fixed bottom navigation: five or six glyph tabs, active one ringed. */
function TabBar({
  items = [],
  value,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      height: 'var(--h-tabbar)',
      padding: '0 var(--s-4)',
      background: 'var(--surface-app)',
      borderTop: '1px solid var(--border-subtle)',
      ...style
    }
  }, items.map(it => {
    const on = it.id === value;
    return /*#__PURE__*/React.createElement("button", {
      key: it.id,
      type: "button",
      "aria-label": it.label,
      "aria-current": on,
      onClick: () => onChange && onChange(it.id),
      style: {
        position: 'relative',
        width: 52,
        height: 52,
        border: 0,
        borderRadius: 'var(--r-md)',
        cursor: 'pointer',
        background: on ? 'var(--surface-raised)' : 'transparent',
        boxShadow: on ? `inset 0 0 0 2px ${it.color || 'var(--marigold-500)'}` : 'none',
        display: 'grid',
        placeItems: 'center',
        transition: 'background var(--dur-fast) linear'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: it.icon,
      size: 28,
      color: on ? it.color || 'var(--marigold-500)' : 'var(--text-muted)'
    }), it.badge ? /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 9,
        height: 9,
        borderRadius: 'var(--r-full)',
        background: 'var(--color-danger)'
      }
    }) : null);
  }));
}
Object.assign(__ds_scope, { TabBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TabBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TopBar.jsx
try { (() => {
/* Metric strip at the top of every screen. Children are MetricChips or IconButtons. */
function TopBar({
  children,
  tone = 'app',
  style
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--s-5)',
      minHeight: 'var(--h-topbar)',
      padding: '0 var(--pad-screen)',
      background: tone === 'brand' ? 'var(--violet-500)' : 'var(--surface-app)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { TopBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TopBar.jsx", error: String((e && e.message) || e) }); }

// components/progress/HabitRing.jsx
try { (() => {
/* Circular completion dial for a single habit or a whole day. */
function HabitRing({
  value = 0,
  max = 1,
  size = 84,
  thickness = 10,
  color = 'var(--habit-done)',
  icon,
  caption,
  style
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      gap: 'var(--s-3)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: 'var(--r-full)',
      display: 'grid',
      placeItems: 'center',
      background: `conic-gradient(${color} ${pct * 360}deg, var(--surface-track) 0deg)`,
      transition: 'background var(--dur-slow) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: size - thickness * 2,
      height: size - thickness * 2,
      borderRadius: 'var(--r-full)',
      background: 'var(--surface-card)',
      display: 'grid',
      placeItems: 'center'
    }
  }, icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: Math.round(size * 0.32),
    color: pct >= 1 ? color : 'var(--text-muted)'
  }) : /*#__PURE__*/React.createElement("span", {
    className: "sk-num",
    style: {
      font: 'var(--fw-bold) var(--fs-lg)/1 var(--font-display)',
      color: 'var(--text-primary)'
    }
  }, Math.round(pct * 100), "%"))), caption ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-caption)',
      color: 'var(--text-secondary)'
    }
  }, caption) : null);
}
Object.assign(__ds_scope, { HabitRing });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/progress/HabitRing.jsx", error: String((e && e.message) || e) }); }

// components/progress/MetricChip.jsx
try { (() => {
/* Top-bar counter: glyph + tabular number in the metric's colour. */
function MetricChip({
  icon,
  value,
  color = 'var(--text-primary)',
  label,
  size = 'md',
  onClick,
  style
}) {
  const big = size === 'lg';
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    "aria-label": label,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--s-4)',
      background: 'none',
      border: 0,
      padding: 'var(--s-2) var(--s-3)',
      cursor: onClick ? 'pointer' : 'default',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: big ? 30 : 24,
    color: color
  }), /*#__PURE__*/React.createElement("span", {
    className: "sk-num",
    style: {
      font: `var(--fw-semibold) ${big ? 'var(--fs-2xl)' : 'var(--fs-xl)'}/1 var(--font-display)`,
      color
    }
  }, value));
}
Object.assign(__ds_scope, { MetricChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/progress/MetricChip.jsx", error: String((e && e.message) || e) }); }

// components/progress/ProgressBar.jsx
try { (() => {
const H = {
  sm: 10,
  md: 18,
  lg: 28
};

/* Inset track + solid fill, with the count printed inside on md/lg. */
function ProgressBar({
  value = 0,
  max = 100,
  size = 'md',
  color = 'var(--cobalt-500)',
  showValue,
  valueLabel,
  style
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const h = H[size] || H.md;
  return /*#__PURE__*/React.createElement("div", {
    role: "progressbar",
    "aria-valuenow": value,
    "aria-valuemax": max,
    style: {
      position: 'relative',
      height: h,
      width: '100%',
      borderRadius: 'var(--r-full)',
      background: 'var(--surface-track)',
      boxShadow: 'var(--shadow-inset)',
      overflow: 'hidden',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${pct * 100}%`,
      height: '100%',
      borderRadius: 'var(--r-full)',
      background: color,
      boxShadow: h >= 18 ? 'inset 0 3px 0 rgba(255,255,255,.28)' : 'none',
      transition: 'width var(--dur-slow) var(--ease-out)'
    }
  }), showValue && h >= 18 ? /*#__PURE__*/React.createElement("span", {
    className: "sk-num",
    style: {
      position: 'absolute',
      inset: 0,
      display: 'grid',
      placeItems: 'center',
      font: `var(--fw-semibold) ${h >= 28 ? 'var(--fs-sm)' : 'var(--fs-2xs)'}/1 var(--font-display)`,
      color: '#fff',
      textShadow: '0 1px 2px rgba(0,0,0,.4)'
    }
  }, valueLabel || `${value} / ${max}`) : null);
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/progress/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/habits/QuestCard.jsx
try { (() => {
/* Timed challenge block: eyebrow + timer, optional art slot, goal, progress, reward. */
function QuestCard({
  eyebrow,
  timeLeft,
  title,
  value = 0,
  max = 1,
  reward,
  rewardIcon = 'gift',
  art,
  color = 'var(--cobalt-500)',
  complete,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--s-5)',
      ...style
    }
  }, eyebrow || timeLeft ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "sk-eyebrow"
  }, eyebrow), timeLeft ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--s-2)',
      font: 'var(--text-eyebrow)',
      letterSpacing: 'var(--ls-caps)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "clock",
    size: 14
  }), timeLeft) : null) : null, art, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--s-5)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'grid',
      gap: 'var(--s-4)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-heading)',
      color: 'var(--text-primary)'
    }
  }, title), /*#__PURE__*/React.createElement(__ds_scope.ProgressBar, {
    value: value,
    max: max,
    showValue: true,
    color: complete ? 'var(--habit-done)' : color
  })), reward ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      gap: 2,
      width: 64
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: rewardIcon,
    size: 34,
    color: complete ? 'var(--marigold-500)' : 'var(--text-disabled)'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-caption)',
      color: 'var(--text-muted)'
    }
  }, reward)) : null));
}
Object.assign(__ds_scope, { QuestCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/habits/QuestCard.jsx", error: String((e && e.message) || e) }); }

// components/progress/StatTile.jsx
try { (() => {
/* One number with a label — the grid unit of the stats screen. */
function StatTile({
  icon,
  value,
  label,
  delta,
  color = 'var(--marigold-500)',
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--r-lg)',
      padding: 'var(--pad-card-tight)',
      display: 'grid',
      gap: 'var(--s-3)',
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 22,
    color: color
  }), /*#__PURE__*/React.createElement("span", {
    className: "sk-num",
    style: {
      font: 'var(--text-metric)',
      color: 'var(--text-primary)'
    }
  }, value), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-caption)',
      color: 'var(--text-muted)'
    }
  }, label), delta ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-caption)',
      color: delta.startsWith('-') ? 'var(--color-danger)' : 'var(--color-success)'
    }
  }, delta) : null);
}
Object.assign(__ds_scope, { StatTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/progress/StatTile.jsx", error: String((e && e.message) || e) }); }

// components/progress/StreakCounter.jsx
try { (() => {
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/* Week strip: one dot per day, plus the running streak total. */
function StreakCounter({
  days = [],
  count = 0,
  unit = 'day streak',
  style
}) {
  const fill = {
    done: 'var(--habit-done)',
    missed: 'var(--habit-missed)',
    rest: 'var(--metric-rest)',
    todo: 'var(--surface-track)'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--s-7)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--s-3)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "flame",
    size: 34,
    color: "var(--metric-streak)"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "sk-num",
    style: {
      font: 'var(--fw-bold) var(--fs-3xl)/1 var(--font-display)',
      color: 'var(--metric-streak)'
    }
  }, count), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-caption)',
      color: 'var(--text-muted)'
    }
  }, unit))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--s-3)'
    }
  }, DAYS.map((d, i) => {
    const state = days[i] || 'todo';
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'grid',
        gap: 'var(--s-2)',
        justifyItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 28,
        height: 28,
        borderRadius: 'var(--r-full)',
        display: 'grid',
        placeItems: 'center',
        background: fill[state],
        color: state === 'todo' ? 'var(--text-disabled)' : 'var(--ink-950)',
        boxShadow: state === 'todo' ? 'var(--shadow-inset)' : 'none'
      }
    }, state === 'done' ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "check",
      size: 16
    }) : state === 'missed' ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "x",
      size: 14
    }) : state === 'rest' ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "moon",
      size: 14
    }) : null), /*#__PURE__*/React.createElement("span", {
      style: {
        font: 'var(--text-caption)',
        color: 'var(--text-muted)'
      }
    }, d));
  })));
}
Object.assign(__ds_scope, { StreakCounter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/progress/StreakCounter.jsx", error: String((e && e.message) || e) }); }

// ui_kits/streaky-app/AddHabitScreen.jsx
try { (() => {
const {
  IconButton,
  Button,
  Input,
  DayPicker,
  Chip,
  Card,
  Icon
} = window.StreakyDesignSystem_c771a6;
const ICONS = ['droplet', 'dumbbell', 'book-open', 'pen-line', 'moon', 'apple', 'footprints', 'brain'];
const CATS = [['Health', 'dumbbell', 'var(--habit-done)'], ['Learning', 'book-open', 'var(--cobalt-500)'], ['Mind', 'brain', 'var(--violet-500)']];
function AddHabitScreen({
  onBack,
  onSave
}) {
  const [name, setName] = React.useState('');
  const [icon, setIcon] = React.useState('droplet');
  const [cat, setCat] = React.useState('Health');
  const [days, setDays] = React.useState([0, 1, 2, 3, 4]);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--s-5)',
      padding: 'var(--s-5) var(--pad-screen)'
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: "x",
    label: "Cancel",
    onClick: onBack
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: 'var(--text-subheading)'
    }
  }, "New habit")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--pad-screen) var(--s-9)',
      display: 'grid',
      gap: 'var(--s-8)'
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "What will you do?",
    value: name,
    onChange: setName,
    placeholder: "e.g. Read 10 pages",
    icon: "pencil"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--s-4)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-label)',
      color: 'var(--text-secondary)'
    }
  }, "Icon"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--s-4)',
      flexWrap: 'wrap'
    }
  }, ICONS.map(i => /*#__PURE__*/React.createElement("button", {
    key: i,
    type: "button",
    "aria-label": i,
    onClick: () => setIcon(i),
    style: {
      width: 48,
      height: 48,
      border: 0,
      borderRadius: 'var(--r-md)',
      cursor: 'pointer',
      background: icon === i ? 'var(--marigold-500)' : 'var(--surface-raised)',
      color: icon === i ? 'var(--text-on-brand)' : 'var(--text-muted)',
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: i,
    size: 22
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--s-4)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-label)',
      color: 'var(--text-secondary)'
    }
  }, "Category"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--s-4)'
    }
  }, CATS.map(([l, i, c]) => /*#__PURE__*/React.createElement(Chip, {
    key: l,
    icon: i,
    color: c,
    selected: cat === l,
    onClick: () => setCat(l)
  }, l)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--s-4)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-label)',
      color: 'var(--text-secondary)'
    }
  }, "Which days?"), /*#__PURE__*/React.createElement(DayPicker, {
    value: days,
    onChange: setDays
  })), /*#__PURE__*/React.createElement(Card, {
    tone: "outline",
    padding: "var(--s-6)",
    style: {
      display: 'flex',
      gap: 'var(--s-5)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "lightbulb",
    size: 20,
    color: "var(--marigold-500)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-caption)',
      color: 'var(--text-secondary)'
    }
  }, "Start smaller than feels useful. You can always raise it.")), /*#__PURE__*/React.createElement(Button, {
    tone: "primary",
    size: "lg",
    fullWidth: true,
    disabled: !name.trim(),
    onClick: onSave
  }, "Add habit")));
}
Object.assign(window, {
  AddHabitScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/streaky-app/AddHabitScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/streaky-app/AppShell.jsx
try { (() => {
const {
  TopBar,
  TabBar,
  MetricChip,
  IconButton,
  Toast,
  Dialog,
  Button,
  EmptyState
} = window.StreakyDesignSystem_c771a6;
const TABS = [{
  id: 'today',
  icon: 'house',
  label: 'Today',
  color: 'var(--marigold-500)'
}, {
  id: 'quests',
  icon: 'target',
  label: 'Quests',
  color: 'var(--cobalt-500)'
}, {
  id: 'stats',
  icon: 'chart-column',
  label: 'Stats',
  color: 'var(--teal-500)'
}, {
  id: 'friends',
  icon: 'users',
  label: 'Friends',
  color: 'var(--coral-500)',
  badge: true
}, {
  id: 'more',
  icon: 'ellipsis',
  label: 'More',
  color: 'var(--violet-500)'
}];
function AppShell() {
  const [tab, setTab] = React.useState('today');
  const [route, setRoute] = React.useState({
    name: 'tabs'
  });
  const [toast, setToast] = React.useState(null);
  const [restSheet, setRestSheet] = React.useState(false);
  const [checkedIn, setCheckedIn] = React.useState({});
  const [gems, setGems] = React.useState(865);
  const [streak, setStreak] = React.useState(12);
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  const openHabit = h => {
    if (h.state === 'locked') {
      setRestSheet(true);
      return;
    }
    setRoute({
      name: 'habit',
      habit: h
    });
  };
  const checkIn = h => {
    if (checkedIn[h.id]) return;
    setCheckedIn(c => ({
      ...c,
      [h.id]: true
    }));
    setGems(g => g + 10);
    setStreak(s => s + 1);
    setToast({
      tone: 'streak',
      text: `${streak + 1} days. Your best run yet.`
    });
  };
  let body;
  if (route.name === 'habit') {
    body = /*#__PURE__*/React.createElement(HabitDetailScreen, {
      habit: route.habit,
      checkedIn: !!checkedIn[route.habit.id],
      onCheckIn: () => checkIn(route.habit),
      onBack: () => setRoute({
        name: 'tabs'
      })
    });
  } else if (route.name === 'add') {
    body = /*#__PURE__*/React.createElement(AddHabitScreen, {
      onBack: () => setRoute({
        name: 'tabs'
      }),
      onSave: () => {
        setRoute({
          name: 'tabs'
        });
        setToast({
          tone: 'success',
          text: 'Habit added. It starts tomorrow.'
        });
      }
    });
  } else if (tab === 'today') {
    body = /*#__PURE__*/React.createElement(TodayScreen, {
      onOpenHabit: openHabit,
      onAddHabit: () => setRoute({
        name: 'add'
      })
    });
  } else if (tab === 'quests') {
    body = /*#__PURE__*/React.createElement(QuestsScreen, null);
  } else if (tab === 'stats') {
    body = /*#__PURE__*/React.createElement(StatsScreen, null);
  } else if (tab === 'friends') {
    body = /*#__PURE__*/React.createElement(EmptyState, {
      title: "No friends yet",
      blurb: "Habits stick better with someone watching. Invite one person.",
      artLabel: "Friends art",
      action: /*#__PURE__*/React.createElement(Button, {
        tone: "action",
        iconLeft: "user-plus"
      }, "Invite a friend")
    });
  } else {
    body = /*#__PURE__*/React.createElement(MoreScreen, null);
  }
  const chrome = route.name === 'tabs';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 'var(--w-app-max)',
      height: 880,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface-app)',
      borderRadius: 'var(--r-2xl)',
      overflow: 'hidden',
      border: '1px solid var(--border-default)'
    }
  }, chrome ? /*#__PURE__*/React.createElement(TopBar, null, /*#__PURE__*/React.createElement(MetricChip, {
    icon: "flame",
    value: streak,
    color: "var(--metric-streak)",
    label: `${streak} day streak`
  }), /*#__PURE__*/React.createElement(MetricChip, {
    icon: "gem",
    value: gems,
    color: "var(--metric-gems)"
  }), /*#__PURE__*/React.createElement(MetricChip, {
    icon: "moon",
    value: 2,
    color: "var(--metric-rest)",
    onClick: () => setRestSheet(true)
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: "settings",
    size: "sm",
    tone: "plain",
    label: "Settings",
    onClick: () => setTab('more')
  })) : null, /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, body), chrome ? /*#__PURE__*/React.createElement(TabBar, {
    items: TABS,
    value: tab,
    onChange: t => {
      setTab(t);
      setRoute({
        name: 'tabs'
      });
    }
  }) : null, toast ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 'var(--s-6)',
      right: 'var(--s-6)',
      bottom: `calc(var(--h-tabbar) + var(--s-5))`
    }
  }, /*#__PURE__*/React.createElement(Toast, {
    tone: toast.tone,
    onDismiss: () => setToast(null)
  }, toast.text)) : null, /*#__PURE__*/React.createElement(Dialog, {
    open: restSheet,
    title: "Use a rest day?",
    onClose: () => setRestSheet(false),
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      tone: "primary",
      fullWidth: true,
      onClick: () => {
        setRestSheet(false);
        setToast({
          tone: 'success',
          text: 'Rest day booked. Streak safe.'
        });
      }
    }, "Use rest day"), /*#__PURE__*/React.createElement(Button, {
      tone: "neutral",
      variant: "ghost",
      fullWidth: true,
      onClick: () => setRestSheet(false)
    }, "Never mind"))
  }, "You have two left this month. Your streak stays intact and you keep your place on the path."));
}
Object.assign(window, {
  AppShell
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/streaky-app/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/streaky-app/HabitDetailScreen.jsx
try { (() => {
const {
  IconButton,
  Button,
  Card,
  StreakCounter,
  HabitRing,
  Switch,
  Badge,
  Divider,
  Icon,
  ArtSlot
} = window.StreakyDesignSystem_c771a6;
function HabitDetailScreen({
  habit,
  onBack,
  onCheckIn,
  checkedIn
}) {
  const [remind, setRemind] = React.useState(true);
  const [rest, setRest] = React.useState(true);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--s-5)',
      padding: 'var(--s-5) var(--pad-screen)'
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: "arrow-left",
    label: "Back",
    onClick: onBack
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: 'var(--text-subheading)'
    }
  }, habit.label), /*#__PURE__*/React.createElement(IconButton, {
    icon: "ellipsis",
    tone: "plain",
    label: "Habit options"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--pad-screen) var(--s-9)',
      display: 'grid',
      gap: 'var(--s-7)'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tone: "card",
    style: {
      display: 'grid',
      gap: 'var(--s-6)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--s-5)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 56,
      height: 56,
      borderRadius: 'var(--r-lg)',
      background: 'var(--marigold-tint)',
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: habit.icon,
    size: 28,
    color: "var(--marigold-500)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-heading)'
    }
  }, habit.label), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-caption)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, "Mon\u2013Fri \xB7 7:30 \xB7 20 min")), /*#__PURE__*/React.createElement(Badge, {
    tone: checkedIn ? 'success' : 'brand'
  }, checkedIn ? 'Done' : 'Today')), /*#__PURE__*/React.createElement(StreakCounter, {
    count: 12,
    days: ['done', 'done', 'rest', 'done', checkedIn ? 'done' : 'todo', 'todo', 'todo']
  }), /*#__PURE__*/React.createElement(Button, {
    tone: checkedIn ? 'success' : 'primary',
    size: "lg",
    fullWidth: true,
    iconLeft: checkedIn ? 'check' : 'circle-check',
    onClick: onCheckIn
  }, checkedIn ? 'Checked in' : 'Check in')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 'var(--s-6)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(HabitRing, {
    value: 5,
    max: 7,
    size: 92,
    caption: "This week"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'grid',
      gap: 'var(--s-4)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-body-sm)',
      color: 'var(--text-secondary)'
    }
  }, "Five of seven this week. Two more keeps the chapter open."), /*#__PURE__*/React.createElement(ArtSlot, {
    ratio: "16/6",
    label: "Milestone art"
  }))), /*#__PURE__*/React.createElement(Divider, {
    label: "Settings"
  }), /*#__PURE__*/React.createElement(Card, {
    tone: "card",
    style: {
      display: 'grid',
      gap: 'var(--s-7)'
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    checked: remind,
    onChange: setRemind,
    label: "Remind me",
    description: "7:30 each weekday"
  }), /*#__PURE__*/React.createElement(Switch, {
    checked: rest,
    onChange: setRest,
    label: "Allow rest days",
    description: "Sundays won't break the streak"
  })), /*#__PURE__*/React.createElement(Button, {
    tone: "action",
    variant: "ghost",
    iconLeft: "trash-2",
    fullWidth: true
  }, "Delete habit")));
}
Object.assign(window, {
  HabitDetailScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/streaky-app/HabitDetailScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/streaky-app/MoreScreen.jsx
try { (() => {
const {
  ArtSlot,
  Card,
  Badge,
  Switch,
  Divider,
  Icon,
  Button,
  MetricChip
} = window.StreakyDesignSystem_c771a6;
const ROWS = [['user', 'Account'], ['bell', 'Notifications'], ['shield', 'Privacy'], ['circle-help', 'Help']];
function MoreScreen() {
  const [dark, setDark] = React.useState(true);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--s-7) var(--pad-screen) var(--s-9)',
      display: 'grid',
      gap: 'var(--s-7)'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    tone: "card",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--s-6)'
    }
  }, /*#__PURE__*/React.createElement(ArtSlot, {
    ratio: "1/1",
    label: "Avatar",
    radius: "var(--r-full)",
    style: {
      width: 72,
      flex: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-heading)'
    }
  }, "Kira"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-caption)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, "Joined March \xB7 184 check-ins")), /*#__PURE__*/React.createElement(Badge, {
    tone: "brand",
    solid: true
  }, "Max")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-around',
      padding: 'var(--s-5) 0',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--r-card)'
    }
  }, /*#__PURE__*/React.createElement(MetricChip, {
    icon: "flame",
    value: 12,
    color: "var(--metric-streak)"
  }), /*#__PURE__*/React.createElement(MetricChip, {
    icon: "gem",
    value: 865,
    color: "var(--metric-gems)"
  }), /*#__PURE__*/React.createElement(MetricChip, {
    icon: "zap",
    value: "1 240",
    color: "var(--metric-xp)"
  })), /*#__PURE__*/React.createElement(Switch, {
    checked: dark,
    onChange: setDark,
    label: "Dark theme",
    description: "Streaky is dark by default"
  }), /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 'var(--s-2)'
    }
  }, ROWS.map(([i, l]) => /*#__PURE__*/React.createElement("button", {
    key: l,
    type: "button",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--s-5)',
      width: '100%',
      padding: 'var(--s-5) var(--s-6)',
      border: 0,
      background: 'transparent',
      cursor: 'pointer',
      borderRadius: 'var(--r-md)',
      color: 'var(--text-primary)',
      font: 'var(--text-body)',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: i,
    size: 20,
    color: "var(--text-muted)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, l), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 18,
    color: "var(--text-disabled)"
  })))), /*#__PURE__*/React.createElement(Button, {
    tone: "neutral",
    variant: "ghost",
    fullWidth: true
  }, "Sign out"));
}
Object.assign(window, {
  MoreScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/streaky-app/MoreScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/streaky-app/QuestsScreen.jsx
try { (() => {
const {
  ScreenHeader,
  QuestCard,
  Card,
  Divider,
  ArtSlot,
  Badge,
  Button,
  Icon
} = window.StreakyDesignSystem_c771a6;
function QuestsScreen() {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(ScreenHeader, {
    title: "Quests",
    blurb: "Finish quests to earn gems.",
    color: "var(--violet-500)",
    artLabel: "Mascot"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--s-8) var(--pad-screen) var(--s-9)',
      display: 'grid',
      gap: 'var(--s-8)'
    }
  }, /*#__PURE__*/React.createElement(QuestCard, {
    eyebrow: "Weekend quest",
    timeLeft: "1D",
    title: "Check in 3 days in a row",
    value: 2,
    max: 3,
    reward: "50 gems",
    rewardIcon: "gem",
    art: /*#__PURE__*/React.createElement(ArtSlot, {
      ratio: "16/7",
      label: "Weekend quest art"
    })
  }), /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement(QuestCard, {
    eyebrow: "Daily quest",
    timeLeft: "6H",
    title: "Earn 10 XP",
    value: 10,
    max: 10,
    complete: true,
    reward: "Chest",
    rewardIcon: "package"
  }), /*#__PURE__*/React.createElement(QuestCard, {
    eyebrow: "Daily quest",
    timeLeft: "6H",
    title: "Check in before 9:00",
    value: 0,
    max: 1,
    reward: "20 gems",
    rewardIcon: "gem"
  }), /*#__PURE__*/React.createElement(Divider, null), /*#__PURE__*/React.createElement(Card, {
    tone: "raised",
    style: {
      display: 'grid',
      gap: 'var(--s-5)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--s-4)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "users",
    size: 22,
    color: "var(--coral-500)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: 'var(--text-subheading)'
    }
  }, "Friends quest"), /*#__PURE__*/React.createElement(Badge, {
    tone: "danger"
  }, "New")), /*#__PURE__*/React.createElement("p", {
    style: {
      font: 'var(--text-body-sm)',
      color: 'var(--text-secondary)'
    }
  }, "Team up with Mara and check in 10 times between you this week."), /*#__PURE__*/React.createElement(Button, {
    tone: "action",
    size: "sm",
    iconLeft: "user-plus"
  }, "Join with Mara"))));
}
Object.assign(window, {
  QuestsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/streaky-app/QuestsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/streaky-app/StatsScreen.jsx
try { (() => {
const {
  StreakCounter,
  SegmentedControl,
  StatTile,
  HabitRing,
  Card,
  Divider,
  Icon
} = window.StreakyDesignSystem_c771a6;
const WEEKS = [4, 6, 5, 7, 7, 3, 6, 7, 5, 7, 6, 7];
function StatsScreen() {
  const [range, setRange] = React.useState('Month');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--s-7) var(--pad-screen) var(--s-9)',
      display: 'grid',
      gap: 'var(--s-8)'
    }
  }, /*#__PURE__*/React.createElement(StreakCounter, {
    count: 12,
    days: ['done', 'done', 'rest', 'done', 'done', 'todo', 'todo']
  }), /*#__PURE__*/React.createElement(SegmentedControl, {
    options: ['Week', 'Month', 'Year'],
    value: range,
    onChange: setRange
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 'var(--s-5)'
    }
  }, /*#__PURE__*/React.createElement(StatTile, {
    icon: "flame",
    value: 12,
    label: "Current streak",
    delta: "+3",
    color: "var(--metric-streak)"
  }), /*#__PURE__*/React.createElement(StatTile, {
    icon: "trophy",
    value: 31,
    label: "Longest streak",
    color: "var(--marigold-500)"
  }), /*#__PURE__*/React.createElement(StatTile, {
    icon: "check-check",
    value: 184,
    label: "Check-ins",
    delta: "+22",
    color: "var(--teal-500)"
  }), /*#__PURE__*/React.createElement(StatTile, {
    icon: "moon",
    value: 2,
    label: "Rest days used",
    color: "var(--metric-rest)"
  })), /*#__PURE__*/React.createElement(Card, {
    style: {
      display: 'grid',
      gap: 'var(--s-6)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "sk-eyebrow"
  }, "CHECK-INS PER WEEK"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 6,
      height: 96
    }
  }, WEEKS.map((v, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      height: `${v / 7 * 100}%`,
      background: v === 7 ? 'var(--habit-done)' : 'var(--cobalt-500)',
      borderRadius: 'var(--r-xs)'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      font: 'var(--text-caption)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Jan"), /*#__PURE__*/React.createElement("span", null, "Mar"))), /*#__PURE__*/React.createElement(Divider, {
    label: "By habit"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement(HabitRing, {
    value: 7,
    max: 7,
    icon: "droplet",
    size: 78,
    color: "var(--cobalt-500)",
    caption: "Water"
  }), /*#__PURE__*/React.createElement(HabitRing, {
    value: 5,
    max: 7,
    icon: "dumbbell",
    size: 78,
    color: "var(--habit-done)",
    caption: "Workout"
  }), /*#__PURE__*/React.createElement(HabitRing, {
    value: 2,
    max: 7,
    icon: "book-open",
    size: 78,
    color: "var(--coral-500)",
    caption: "Read"
  })), /*#__PURE__*/React.createElement(Card, {
    tone: "outline",
    padding: "var(--s-6)",
    style: {
      display: 'flex',
      gap: 'var(--s-5)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 20,
    color: "var(--text-muted)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-caption)',
      color: 'var(--text-muted)'
    }
  }, "Rest days count as kept, not missed.")));
}
Object.assign(window, {
  StatsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/streaky-app/StatsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/streaky-app/TodayScreen.jsx
try { (() => {
const {
  UnitBanner,
  HabitNode,
  IconButton,
  Divider,
  Button,
  Card,
  Icon
} = window.StreakyDesignSystem_c771a6;
const PATH = [{
  id: 'water',
  icon: 'droplet',
  label: 'Drink water',
  state: 'done',
  offset: -58
}, {
  id: 'stretch',
  icon: 'activity',
  label: 'Stretch 5 min',
  state: 'done',
  offset: 0
}, {
  id: 'workout',
  icon: 'dumbbell',
  label: 'Workout',
  state: 'active',
  offset: 58,
  current: true
}, {
  id: 'read',
  icon: 'book-open',
  label: 'Read 10 pages',
  state: 'locked',
  offset: 0
}, {
  id: 'journal',
  icon: 'pen-line',
  label: 'Evening pages',
  state: 'locked',
  offset: -58
}];
function TodayScreen({
  onOpenHabit,
  onAddHabit
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 var(--pad-screen) var(--s-9)'
    }
  }, /*#__PURE__*/React.createElement(UnitBanner, {
    eyebrow: "Week 4 \xB7 Mornings",
    title: "Build a wake-up routine",
    onAction: () => {},
    color: "var(--teal-500)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'grid',
      gap: 'var(--s-8)',
      justifyItems: 'center',
      padding: 'var(--s-9) 0 var(--s-7)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 0,
      top: 'var(--s-7)',
      display: 'grid',
      gap: 'var(--s-4)'
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: "volume-2",
    shape: "circle",
    active: true,
    label: "Sound on"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: "bell-off",
    shape: "circle",
    label: "Mute reminders"
  })), PATH.map(h => /*#__PURE__*/React.createElement(HabitNode, {
    key: h.id,
    icon: h.icon,
    label: h.label,
    state: h.state,
    offset: h.offset,
    current: h.current,
    onClick: () => onOpenHabit(h)
  }))), /*#__PURE__*/React.createElement(Divider, {
    label: "Tomorrow"
  }), /*#__PURE__*/React.createElement(Card, {
    tone: "outline",
    padding: "var(--s-6)",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--s-5)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sunrise",
    size: 24,
    color: "var(--text-muted)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      font: 'var(--text-body-sm)',
      color: 'var(--text-secondary)'
    }
  }, "Three habits unlock at 6:00.")), /*#__PURE__*/React.createElement(Button, {
    tone: "neutral",
    variant: "outline",
    iconLeft: "plus",
    fullWidth: true,
    style: {
      marginTop: 'var(--s-6)'
    },
    onClick: onAddHabit
  }, "Add a habit"));
}
Object.assign(window, {
  TodayScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/streaky-app/TodayScreen.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.Divider = __ds_scope.Divider;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.DayPicker = __ds_scope.DayPicker;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.ArtSlot = __ds_scope.ArtSlot;

__ds_ns.HabitNode = __ds_scope.HabitNode;

__ds_ns.HabitRow = __ds_scope.HabitRow;

__ds_ns.QuestCard = __ds_scope.QuestCard;

__ds_ns.UnitBanner = __ds_scope.UnitBanner;

__ds_ns.ScreenHeader = __ds_scope.ScreenHeader;

__ds_ns.TabBar = __ds_scope.TabBar;

__ds_ns.TopBar = __ds_scope.TopBar;

__ds_ns.HabitRing = __ds_scope.HabitRing;

__ds_ns.MetricChip = __ds_scope.MetricChip;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.StatTile = __ds_scope.StatTile;

__ds_ns.StreakCounter = __ds_scope.StreakCounter;

})();
