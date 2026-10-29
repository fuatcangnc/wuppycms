// Token'ların durağan (at-rest) şifrelenmesi.
//
// TuranCMS'teki desenin WebCrypto karşılığı: AES-256-GCM, `iv:tag:ciphertext`
// (hex) formatı ve deterministik arama için HMAC-SHA256 indeksi. Format bilinçli
// olarak aynı tutuldu — taşıma/karşılaştırma kolay olsun diye.
//
// Anahtar yoksa fonksiyonlar düz metni aynen döndürür (geliştirme kolaylığı);
// üretimde TOKEN_ENCRYPTION_KEY tanımlanmalıdır (64 hex karakter).

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let warnedMissingKey = false;

function warnOnce(): void {
	if (!warnedMissingKey) {
		warnedMissingKey = true;
		console.warn(
			"[crypto] TOKEN_ENCRYPTION_KEY tanımlı değil — token'lar düz metin saklanıyor. " +
				"Üretimde mutlaka ayarlayın (openssl rand -hex 32).",
		);
	}
}

/** 64 hex karakteri 32 bayta çevirir; başka bir dizeyi SHA-256 ile 32 bayta indirir. */
async function importKey(keyHex: string): Promise<CryptoKey> {
	const raw: Uint8Array<ArrayBuffer> = /^[0-9a-fA-F]{64}$/.test(keyHex)
		? hexToBytes(keyHex)
		: new Uint8Array(await crypto.subtle.digest("SHA-256", textEncoder.encode(keyHex)));
	return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** `iv:tag:ciphertext` (hex) — TuranCMS formatıyla uyumlu. */
export async function encryptToken(plaintext: string, keyHex?: string): Promise<string> {
	if (!keyHex) {
		warnOnce();
		return plaintext;
	}
	const key = await importKey(keyHex);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const sealed = new Uint8Array(
		await crypto.subtle.encrypt(
			{ name: "AES-GCM", iv },
			key,
			new Uint8Array(textEncoder.encode(plaintext)),
		),
	);
	// WebCrypto çıktısı: ciphertext || tag (son 16 bayt). Format için ayırıyoruz.
	const tag = sealed.slice(sealed.length - 16);
	const data = sealed.slice(0, sealed.length - 16);
	return `${bytesToHex(iv)}:${bytesToHex(tag)}:${bytesToHex(data)}`;
}

/** Şifreli değeri çözer; format dışı (düz metin) girdiyi olduğu gibi döndürür. */
export async function decryptToken(ciphertext: string, keyHex?: string): Promise<string> {
	const parts = ciphertext.split(":");
	if (!keyHex || parts.length !== 3) return ciphertext;
	const [ivHex, tagHex, dataHex] = parts;
	const key = await importKey(keyHex);
	const iv = hexToBytes(ivHex);
	const tag = hexToBytes(tagHex);
	const data = hexToBytes(dataHex);
	const sealed = new Uint8Array(data.length + tag.length);
	sealed.set(data, 0);
	sealed.set(tag, data.length);
	try {
		const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, sealed);
		return textDecoder.decode(plain);
	} catch {
		// Anahtar döndü ya da değer bozuk — çağıran tarafın yeniden bağlanması gerekir.
		return ciphertext;
	}
}

/**
 * Şifreli saklanan bir değer için deterministik arama indeksi (HMAC-SHA256).
 * Aynı token her yazımda farklı şifrelendiği için eşitlik sorgusu yapılamaz;
 * bu indeks yapılabilir.
 */
export async function tokenIndex(value: string, keyHex?: string): Promise<string | null> {
	if (!keyHex || !value) return null;
	const key = await importKey(keyHex);
	const mac = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
	return bytesToHex(new Uint8Array(mac));
}
