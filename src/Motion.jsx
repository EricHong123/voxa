import React from 'react';
import {motion, useReducedMotion} from 'motion/react';

export const spring = {type: 'spring', stiffness: 380, damping: 30};
export const smooth = {duration: .35, ease: [.22, 1, .36, 1]};

// No exit delay: destination controls and cancellation remain immediately available.
export function PageSurface({children}) {
  const reduce = useReducedMotion();
  return <motion.div className="content" initial={reduce ? false : {opacity: .4, y: 12}}
    animate={{opacity: 1, y: 0}} transition={smooth}>{children}</motion.div>;
}

export function Selection({id}) {
  const reduce = useReducedMotion();
  return <motion.span aria-hidden="true" className="selection-surface"
    layoutId={reduce ? undefined : id} transition={spring}/>;
}

export function RecordHalo({active, level, children}) {
  const reduce = useReducedMotion();
  const amplitude = Math.min(1, Math.max(0, Number.isFinite(level) ? level : 0));
  return <div className={'record-halo '+(active ? 'is-listening' : '')}>
    {[0, 1].map(i => <motion.span key={i} aria-hidden="true" className="voice-orbit"
      initial={false} animate={{scale: active && !reduce ? 1.12 + i * .19 + amplitude * .45 : 1,
        opacity: active ? .26 - i * .09 : 0}} transition={{duration: .16}}/>)}
    {children}
  </div>;
}

export function SuccessMark() {
  const reduce = useReducedMotion();
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <motion.path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" initial={reduce ? false : {pathLength: 0}}
      animate={{pathLength: 1}} transition={{duration: .32}}/>
  </svg>;
}

// This rhythm indicates recording, not measured microphone amplitude.
export function ListeningMark() {
  return <span className="listening-bars" aria-hidden="true">{[0,1,2,3,4].map(i =>
    <i key={i} style={{'--bar-delay': `${i * -.14}s`, '--bar-height': `${[8,16,22,14,9][i]}px`}}/>)}</span>;
}
