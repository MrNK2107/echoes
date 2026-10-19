import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { BackButton } from './BackButton';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

describe('BackButton', () => {
  it('pads the top inset on its wrapper and is a 44dp labelled button', async () => {
    await render(<BackButton />);
    const button = screen.getByRole('button', { name: 'Back' });
    expect(StyleSheet.flatten(button.props.style).minHeight).toBe(44);
    expect(StyleSheet.flatten(screen.getByTestId('back-wrapper').props.style).paddingTop).toBe(47);
  });

  it('goes back when pressed', async () => {
    await render(<BackButton />);
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
  });
});

describe('BackButton onPress and testID', () => {
  it('uses the given onPress instead of going back and exposes back-button', async () => {
    mockBack.mockClear();
    const onPress = jest.fn();
    await render(<BackButton onPress={onPress} />);
    await fireEvent.press(screen.getByTestId('back-button'));
    expect(onPress).toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });
});
