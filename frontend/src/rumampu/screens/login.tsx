import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError, login } from '../api';

export function LoginScreen({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [identifier, setIdentifier] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const submit = async () => {
    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier || !password) {
      setError('Enter your username/email and password.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await login(cleanIdentifier, password);
      onLoggedIn();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Could not reach the RuMampu backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Log in</Text>

      <TextInput
        value={identifier}
        onChangeText={setIdentifier}
        placeholder="Username or email"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        autoCapitalize="none"
        style={styles.input}
        onSubmitEditing={() => void submit()}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={() => void submit()}
        disabled={loading}
        style={({ pressed }) => [styles.button, (pressed || loading) && styles.buttonDisabled]}
      >
        {loading ? <ActivityIndicator /> : <Text style={styles.buttonText}>Enter</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#999999',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: {
    color: '#b00020',
  },
  button: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
