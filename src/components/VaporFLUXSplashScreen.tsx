import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';

const { width, height } = Dimensions.get('window');

interface VaporFLUXSplashScreenProps {
  onFinish: () => void;
}

const VaporFLUXSplashScreen: React.FC<VaporFLUXSplashScreenProps> = ({ onFinish }) => {
  const [logoAnim] = useState(new Animated.Value(0));
  const [textAnim] = useState(new Animated.Value(0));
  const [progressAnim] = useState(new Animated.Value(0));
  const [glowAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Keep splash screen visible
    SplashScreen.preventAutoHideAsync();

    // Start animations sequence
    const animationSequence = Animated.sequence([
      // Logo entrance with spring effect
      Animated.spring(logoAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      
      // Text fade in
      Animated.timing(textAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      
      // Progress bar animation
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: false,
      }),
    ]);

    // Glow pulsing effect
    const glowPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    // Start animations
    glowPulse.start();
    animationSequence.start(() => {
      // Finish splash after animations complete
      setTimeout(() => {
        SplashScreen.hideAsync();
        onFinish();
      }, 500);
    });

    return () => {
      glowPulse.stop();
    };
  }, []);

  const logoScale = logoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  const logoTranslateY = logoAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [50, 0],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <LinearGradient
        colors={['#0a0a0a', '#1a1a1a', '#0a0a0a']}
        style={styles.container}
      >
        {/* Background glow effect */}
        <Animated.View 
          style={[
            styles.backgroundGlow,
            { opacity: glowOpacity }
          ]}
        />

        {/* Main content */}
        <View style={styles.content}>
          {/* Logo with glow */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                transform: [
                  { scale: logoScale },
                  { translateY: logoTranslateY }
                ]
              }
            ]}
          >
            <View style={styles.logoGlow}>
              <Image
                source={require('../../assets/vaporFLUX_icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </Animated.View>

          {/* App name and tagline */}
          <Animated.View
            style={[
              styles.textContainer,
              { opacity: textAnim }
            ]}
          >
            <Text style={styles.appName}>VaporFLUX</Text>
            <Text style={styles.tagline}>AI Trading Intelligence</Text>
            <Text style={styles.version}>v1.0.0</Text>
          </Animated.View>

          {/* Loading progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { width: progressWidth }
                ]}
              />
            </View>
            <Animated.Text 
              style={[
                styles.loadingText,
                { opacity: textAnim }
              ]}
            >
              Inicializando IA...
            </Animated.Text>
          </View>
        </View>

        {/* Bottom branding */}
        <Animated.View
          style={[
            styles.footer,
            { opacity: textAnim }
          ]}
        >
          <Text style={styles.footerText}>Powered by Advanced AI Algorithms</Text>
        </Animated.View>
      </LinearGradient>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundGlow: {
    position: 'absolute',
    width: width * 2,
    height: width * 2,
    borderRadius: width,
    backgroundColor: '#2c5aa0',
    opacity: 0.1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    marginBottom: 60,
    alignItems: 'center',
  },
  logoGlow: {
    shadowColor: '#2c5aa0',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 20,
  },
  logo: {
    width: 120,
    height: 120,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 80,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 16,
    color: '#2c5aa0',
    textAlign: 'center',
    marginBottom: 4,
    fontWeight: '500',
  },
  version: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: '80%',
    height: 3,
    backgroundColor: '#333333',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2c5aa0',
    borderRadius: 2,
  },
  loadingText: {
    fontSize: 14,
    color: '#cccccc',
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
});

export default VaporFLUXSplashScreen;
