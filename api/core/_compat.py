"""Streamlit 의존 제거용 경량 shim.
core/*.py 가 쓰던 st.cache_data / st.secrets 를 FastAPI 환경에서 대체한다.
- cache_data: 무캐시 패스스루 데코레이터 (ttl 등 인자 무시)
- secrets: os.environ 으로 폴백
"""
import os


def cache_data(*dargs, **dkwargs):
    # @cache_data 또는 @cache_data(ttl=...) 둘 다 지원
    if len(dargs) == 1 and callable(dargs[0]) and not dkwargs:
        return dargs[0]
    def deco(fn):
        return fn
    return deco


class _Secrets:
    def __getitem__(self, k):
        v = os.environ.get(k)
        if v is None:
            raise KeyError(k)
        return v
    def get(self, k, default=None):
        return os.environ.get(k, default)
    def __contains__(self, k):
        return k in os.environ


secrets = _Secrets()
