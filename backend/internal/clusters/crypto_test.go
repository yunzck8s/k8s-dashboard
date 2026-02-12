package clusters

import (
	"encoding/base64"
	"testing"
)

func TestCryptoEncryptDecrypt(t *testing.T) {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1)
	}
	t.Setenv(encryptionKeyEnv, base64.StdEncoding.EncodeToString(key))

	c, err := NewCryptoFromEnv("jwt-secret")
	if err != nil {
		t.Fatalf("new crypto failed: %v", err)
	}

	plain := []byte("apiVersion: v1\nclusters:\n- name: demo\n")
	enc, err := c.Encrypt(plain)
	if err != nil {
		t.Fatalf("encrypt failed: %v", err)
	}
	if enc == string(plain) {
		t.Fatalf("ciphertext should not equal plaintext")
	}

	dec, err := c.Decrypt(enc)
	if err != nil {
		t.Fatalf("decrypt failed: %v", err)
	}
	if string(dec) != string(plain) {
		t.Fatalf("unexpected decrypt content: %q", string(dec))
	}
}

func TestCryptoDecryptWithWrongKeyFails(t *testing.T) {
	keyA := make([]byte, 32)
	keyB := make([]byte, 32)
	for i := range keyA {
		keyA[i] = byte(i + 10)
		keyB[i] = byte(i + 60)
	}

	t.Setenv(encryptionKeyEnv, base64.StdEncoding.EncodeToString(keyA))
	a, err := NewCryptoFromEnv("jwt-secret")
	if err != nil {
		t.Fatalf("new crypto A failed: %v", err)
	}
	enc, err := a.Encrypt([]byte("hello"))
	if err != nil {
		t.Fatalf("encrypt failed: %v", err)
	}

	t.Setenv(encryptionKeyEnv, base64.StdEncoding.EncodeToString(keyB))
	b, err := NewCryptoFromEnv("jwt-secret")
	if err != nil {
		t.Fatalf("new crypto B failed: %v", err)
	}
	if _, err := b.Decrypt(enc); err == nil {
		t.Fatalf("expected decrypt with wrong key to fail")
	}
}
