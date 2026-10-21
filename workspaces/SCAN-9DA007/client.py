import requests

def fetch_url(target_url):
    return requests.get(target_url)

def run():
    fetch_url("http://example.com")
