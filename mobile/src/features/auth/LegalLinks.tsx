import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useServices } from '@/services/ServicesProvider';
import { PRIVACY_POLICY_LABEL } from '@/ui/copy';
import { colors } from '@/ui/theme';

function openLink(url: string) {
  Linking.openURL(url).catch((e: unknown) => console.warn('Could not open link', e));
}

/** Terms, Community Guidelines and Privacy Policy as separate focusable links (config: EXPO_PUBLIC_*_URL). */
export function LegalLinks() {
  const { config } = useServices();
  const links = [
    { label: 'Terms of Service', url: config.termsUrl },
    { label: 'Community Guidelines', url: config.guidelinesUrl },
    { label: PRIVACY_POLICY_LABEL, url: config.privacyUrl },
  ];
  return (
    <View style={styles.links}>
      {links.map((l) => (
        <Pressable key={l.label} accessibilityRole="link" hitSlop={8} onPress={() => openLink(l.url)}>
          <Text style={styles.link}>{l.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginTop: 8, marginLeft: 32 },
  link: { color: colors.accent, fontSize: 14, textDecorationLine: 'underline' },
});
