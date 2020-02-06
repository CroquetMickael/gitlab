"use strict";

// https://gitlab.com/api/v4/projects/<project_id>/repository/archive.zip?sha=<tag>

// Require Node.js Dependencies
const { promisify } = require("util");
const { createWriteStream, createReadStream, promises: { unlink } } = require("fs");
const { join } = require("path");
const { createGunzip } = require("zlib");
const stream = require("stream");

// Require Third-party Dependencies
const tar = require("tar-fs");
const is = require("@slimio/is");
const { https } = require("follow-redirects");

// CONSTANTS
const GITLAB_URL = new URL("https://gitlab.com/api/v4/projects/");

// ASYNC
const pipeline = promisify(stream.pipeline);

/**
 * @async
 * @function download
 * @param {*} repositoryId repository
 * @param {*} options options
 * @param {string} [options.branch=master] branch to download
 * @param {string} [options.dest] destination to transfert file
 * @param {boolean} [options.extract] Enable .zip extraction!
 * @param {boolean} [options.unlink] Unlink tar.gz file on extraction
 * @param {string} [options.auth] auth for private repository
 * @returns {Promise<string>}
 *
 * @throws {TypeError}
 */
async function download(repositoryId, options = Object.create(null)) {
    if (typeof repositoryId !== "string") {
        throw new TypeError("repositoryId must be a string!");
    }
    if (!is.plainObject(options)) {
        throw new TypeError("options must be a plain javascript object!");
    }

    // Retrieve options
    const { branch = "master", dest = process.cwd(), extract = false, unlink: ulk = true, auth } = options;

    // Create URL!
    const gitUrl = new URL(`${repositoryId}/repository/archive.tar.gz?ref=${branch}`, GITLAB_URL);
    const fileDestination = join(dest, `${repositoryId}-${branch}.tar.gz`);

    await new Promise((resolve, reject) => {
        const headers = {
            "User-Agent": "SlimIO",
            "Accept-Encoding": "gzip, deflate"
        };
        const options = { headers, timeout: 5000 };
        if (typeof auth === "string") {
            headers.Authorization = `token ${auth}`;
        }

        https.get(gitUrl.href, options, (res) => {
            if (res.statusCode === 404) {
                reject(Error(res.statusMessage));
            }
            else {
                res.pipe(createWriteStream(fileDestination));
                res.once("error", reject);
                res.once("end", resolve);
            }
        });
    });

    // // Extract .tar.gz archive
    if (extract) {
        await pipeline(
            createReadStream(fileDestination),
            createGunzip(),
            tar.extract(dest)
        );
        if (ulk) {
            await unlink(fileDestination);
        }

        return join(dest, `${repositoryId}-${branch}`);
    }

    return fileDestination;
}

module.exports = download;