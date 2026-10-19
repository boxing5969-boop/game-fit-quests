"""배포 인증서용 RSA 개인키를 App Store Connect API 키(.p8)에서 '항상 같은 값'으로 만든다.

왜: 애플 배포 인증서는 계정당 몇 개뿐이라 빌드마다 새로 만들면 금방 막힌다.
    같은 개인키를 쓰면 처음 한 번 만든 인증서를 계속 다시 쓴다.
    따로 비밀값을 하나 더 등록하지 않아도 되게, 이미 등록한 ASC_PRIVATE_KEY 에서 꺼낸다.
    (이 키의 안전함은 ASC_PRIVATE_KEY 의 안전함과 같다 — 그 키는 원래 계정 전체 권한이다.)

사용: python3 derive_cert_key.py <p8 파일> <출력 pem 파일>
     출력 파일만 쓴다. 키 내용은 절대 화면(로그)에 찍지 않는다 — 공개 저장소라 로그가 공개된다.
pycryptodome 버전을 고정해야 같은 키가 나온다 (워크플로에서 3.23.0 으로 고정).
"""
import hashlib
import hmac
import sys

from Crypto.PublicKey import RSA


class _Stream:
    """HMAC-SHA256 카운터 방식의 결정적 난수열"""

    def __init__(self, seed: bytes):
        self.seed = seed
        self.counter = 0
        self.buf = b""

    def __call__(self, n: int) -> bytes:
        while len(self.buf) < n:
            self.counter += 1
            self.buf += hmac.new(self.seed, b"myboxer153-ios-cert/%d" % self.counter, hashlib.sha256).digest()
        out, self.buf = self.buf[:n], self.buf[n:]
        return out


def main() -> None:
    p8_path, out_path = sys.argv[1], sys.argv[2]
    raw = open(p8_path, "rb").read()
    body = b"".join(line.strip() for line in raw.splitlines() if line and not line.startswith(b"-----"))
    seed = hashlib.sha256(b"myboxer153 distribution certificate v1|" + body).digest()
    key = RSA.generate(2048, randfunc=_Stream(seed))
    with open(out_path, "wb") as f:
        f.write(key.export_key(format="PEM", pkcs=1))
    print("인증서 개인키 준비 완료 (내용은 출력하지 않음)")


if __name__ == "__main__":
    main()
