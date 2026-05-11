import { useMemo } from 'react';
import { createScoreTimeline } from '../music/scoreTimeline';
import { PracticePlayerLegacy } from './PracticePlayerLegacy';
import { PracticePlayerV2 } from './PracticePlayerV2';
import type { PracticeScreenProps } from './practicePlayerTypes';

export const PracticeScreen = (props: PracticeScreenProps) => {
  const timeline = useMemo(() => createScoreTimeline(props.lesson), [props.lesson]);

  if (timeline.autoPlayable) {
    return <PracticePlayerV2 {...props} timeline={timeline} />;
  }

  return <PracticePlayerLegacy {...props} timeline={timeline} />;
};
