import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme/colors';

const TestScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Test Screen Working</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  text: {
    fontSize: 18,
    color: theme.textPrimary,
    fontWeight: 'bold',
  },
});

export default TestScreen;
