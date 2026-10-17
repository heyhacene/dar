export interface LatestApkRelease {
  version: string;
  buildNumber: number | null;
  filename: string;
  downloadUrl: string;
  sizeBytes: number;
}

export async function fetchLatestDarApk(): Promise<LatestApkRelease | null> {
  try {
    const res = await fetch('https://api.github.com/repos/heyhacene/dar/releases/latest', {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.assets)) return null;

    // Priorité absolue au fichier nommé KeoFamily-Build-XX.apk
    const buildAsset = data.assets.find(
      (a: any) => typeof a.name === 'string' && a.name.startsWith('KeoFamily-Build-') && a.name.endsWith('.apk')
    );

    const asset = buildAsset || data.assets.find(
      (a: any) => typeof a.name === 'string' && a.name.endsWith('.apk')
    );

    if (!asset) return null;

    const buildMatch = asset.name.match(/Build-(\d+)/i) || data.tag_name?.match(/build\.(\d+)/i);
    const buildNum = buildMatch ? parseInt(buildMatch[1], 10) : null;

    return {
      version: data.tag_name || 'v1.3.0',
      buildNumber: buildNum,
      filename: asset.name,
      downloadUrl: asset.browser_download_url,
      sizeBytes: asset.size || 0,
    };
  } catch (err) {
    console.warn('Erreur lors de la récupération du dernier APK Keo Family:', err);
    return null;
  }
}
