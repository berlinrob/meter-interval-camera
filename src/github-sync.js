const API_ROOT = "https://api.github.com";

function splitRepository(repository) {
  const [owner, name, ...extra] = repository.trim().split("/");
  if (!owner || !name || extra.length) throw new Error("Use the format owner/repository.");
  return { owner, name };
}

async function responseJson(response) {
  if (response.status === 204) return null;
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || `GitHub request failed (${response.status}).`);
  return payload;
}

function asBase64(bytes) {
  let result = "";
  const view = new Uint8Array(bytes);
  for (let index = 0; index < view.length; index += 0x8000) result += String.fromCharCode(...view.subarray(index, index + 0x8000));
  return btoa(result);
}

function fromBase64(content) {
  const binary = atob(content.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return bytes;
}

export class GitHubSync {
  constructor(repository, token) {
    this.repository = splitRepository(repository);
    this.token = token;
  }

  path(path) { return `/repos/${this.repository.owner}/${this.repository.name}${path}`; }

  async request(path, options = {}) {
    const response = await fetch(`${API_ROOT}${path}`, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...options.headers,
      },
    });
    return responseJson(response);
  }

  async verify() {
    const repository = await this.request(this.path(""));
    if (!repository.private) throw new Error("This repository is public. Choose a private repository for meter photos.");
    return repository;
  }

  async existingFile(path) {
    const response = await fetch(`${API_ROOT}${this.path(`/contents/${path}`)}`, {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${this.token}`, "X-GitHub-Api-Version": "2022-11-28" },
    });
    if (response.status === 404) return null;
    return responseJson(response);
  }

  async putFile(path, bytes, message) {
    const current = await this.existingFile(path);
    await this.request(this.path(`/contents/${path}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, content: asBase64(bytes), ...(current ? { sha: current.sha } : {}) }),
    });
  }

  async uploadCapture(capture) {
    const imagePath = `captures/${capture.syncId}.jpg`;
    const metadataPath = `captures/${capture.syncId}.json`;
    if (!capture.remoteSynced) await this.putFile(imagePath, await capture.blob.arrayBuffer(), `Add meter photo ${capture.syncId}`);
    const metadata = {
      version: 1,
      syncId: capture.syncId,
      createdAt: capture.createdAt,
      reading: capture.reading,
      ocr: capture.ocr,
      ocrConfidence: capture.ocrConfidence,
      imagePath,
    };
    await this.putFile(metadataPath, new TextEncoder().encode(JSON.stringify(metadata, null, 2)), `Update meter reading ${capture.syncId}`);
  }

  async listCaptures() {
    let tree;
    try { tree = await this.request(this.path("/git/trees/HEAD?recursive=1")); } catch (error) {
      if (/Not Found/.test(error.message)) return [];
      throw error;
    }
    const entries = tree.tree.filter((entry) => entry.type === "blob" && entry.path.startsWith("captures/") && entry.path.endsWith(".json"));
    const captures = [];
    for (const entry of entries) {
      const metadataFile = await this.request(this.path(`/contents/${entry.path}`));
      const metadata = JSON.parse(new TextDecoder().decode(fromBase64(metadataFile.content)));
      const imageFile = await this.request(this.path(`/contents/${metadata.imagePath}`));
      captures.push({ ...metadata, blob: new Blob([fromBase64(imageFile.content)], { type: "image/jpeg" }), remote: true, syncStatus: "Private copy in GitHub" });
    }
    return captures;
  }
}
