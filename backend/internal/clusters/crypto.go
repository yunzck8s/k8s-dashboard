package clusters

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
)

const (
	encryptionKeyEnv = "CLUSTER_ENCRYPTION_KEY"
)

// Crypto 负责 kubeconfig 的加解密。
type Crypto struct {
	key []byte
}

// NewCryptoFromEnv 创建加密器。
// 优先使用 CLUSTER_ENCRYPTION_KEY（Base64 编码的 32 字节），
// 未配置时退化为 SHA-256(JWT_SECRET)。
func NewCryptoFromEnv(jwtSecret string) (*Crypto, error) {
	key, err := loadEncryptionKey(jwtSecret)
	if err != nil {
		return nil, err
	}
	return &Crypto{key: key}, nil
}

func loadEncryptionKey(jwtSecret string) ([]byte, error) {
	keyB64 := strings.TrimSpace(os.Getenv(encryptionKeyEnv))
	if keyB64 != "" {
		key, err := base64.StdEncoding.DecodeString(keyB64)
		if err != nil {
			return nil, fmt.Errorf("decode %s failed: %w", encryptionKeyEnv, err)
		}
		if len(key) != 32 {
			return nil, fmt.Errorf("%s must decode to 32 bytes, got %d", encryptionKeyEnv, len(key))
		}
		return key, nil
	}

	if jwtSecret == "" {
		return nil, fmt.Errorf("%s is not set and JWT secret is empty", encryptionKeyEnv)
	}

	sum := sha256.Sum256([]byte(jwtSecret))
	log.Printf("WARNING: %s is not set, deriving cluster encryption key from JWT_SECRET", encryptionKeyEnv)
	return sum[:], nil
}

// Encrypt 将明文加密为 Base64 编码字符串。
func (c *Crypto) Encrypt(plain []byte) (string, error) {
	if len(plain) == 0 {
		return "", nil
	}

	block, err := aes.NewCipher(c.key)
	if err != nil {
		return "", fmt.Errorf("create cipher failed: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create gcm failed: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("read nonce failed: %w", err)
	}

	ciphertext := gcm.Seal(nil, nonce, plain, nil)
	buf := append(nonce, ciphertext...)
	return base64.StdEncoding.EncodeToString(buf), nil
}

// Decrypt 解密 Base64 编码的密文。
func (c *Crypto) Decrypt(encoded string) ([]byte, error) {
	if strings.TrimSpace(encoded) == "" {
		return nil, nil
	}

	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("decode ciphertext failed: %w", err)
	}

	block, err := aes.NewCipher(c.key)
	if err != nil {
		return nil, fmt.Errorf("create cipher failed: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create gcm failed: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(raw) < nonceSize {
		return nil, fmt.Errorf("ciphertext too short")
	}
	nonce, ciphertext := raw[:nonceSize], raw[nonceSize:]

	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("decrypt failed: %w", err)
	}
	return plain, nil
}
