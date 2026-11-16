namespace UATSystem.API.Helpers;

public static class UrlBuilder
{
    public static string BuildAbsoluteUrl(HttpRequest request, string? relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
        {
            return string.Empty;
        }

        if (Uri.TryCreate(relativePath, UriKind.Absolute, out var absoluteUri))
        {
            return absoluteUri.ToString();
        }

        var scheme = request.Scheme;
        var host = request.Host.HasValue ? request.Host.Value : string.Empty;
        var pathBase = request.PathBase.Value ?? string.Empty;

        if (string.IsNullOrWhiteSpace(host))
        {
            return relativePath;
        }

        var normalizedPath = relativePath.StartsWith('/') ? relativePath : $"/{relativePath}";

        if (!string.IsNullOrEmpty(pathBase) &&
            (normalizedPath.Equals(pathBase, StringComparison.OrdinalIgnoreCase) ||
             normalizedPath.StartsWith(pathBase + "/", StringComparison.OrdinalIgnoreCase)))
        {
            return $"{scheme}://{host}{normalizedPath}";
        }

        if (!string.IsNullOrEmpty(pathBase))
        {
            normalizedPath = $"{pathBase}{normalizedPath}";
        }

        return $"{scheme}://{host}{normalizedPath}";
    }
}
