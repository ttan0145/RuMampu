def only_public_v1_endpoints(endpoints):
    """Keep compatibility aliases out of the published OpenAPI contract."""
    return [endpoint for endpoint in endpoints if endpoint[0].startswith("/api/v1/")]
