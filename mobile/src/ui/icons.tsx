import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from './theme';

const SIZE = 20;

type IconProps = { color?: string };

/** Decorative: the surrounding button carries the accessibility label. */
function Icon({ testID, color, children }: IconProps & { testID: string; children: React.ReactNode }) {
  return (
    <Svg
      testID={testID}
      width={SIZE}
      height={SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? colors.background}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
      importantForAccessibility="no"
    >
      {children}
    </Svg>
  );
}

export function CommunitiesIcon({ color }: IconProps) {
  return (
    <Icon testID="icon-communities" color={color}>
      <Circle cx={9} cy={8} r={3.5} />
      <Path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <Circle cx={17.5} cy={9} r={2.5} />
      <Path d="M17 14c2.6 0 4.5 1.7 4.5 4.5" />
    </Icon>
  );
}

export function ProfileIcon({ color }: IconProps) {
  return (
    <Icon testID="icon-profile" color={color}>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </Icon>
  );
}

export function BellIcon({ color }: IconProps) {
  return (
    <Icon testID="icon-bell" color={color}>
      <Path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z" />
      <Path d="M10 21a2 2 0 0 0 4 0" />
    </Icon>
  );
}
