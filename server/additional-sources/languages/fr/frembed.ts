// only voe works on web without a server

import { voeResolve } from "../../embeds/voe";
import { uqloadResolve } from "../../embeds/uqload";
import 'dotenv/config'

const remote = process.env.disable_same_ip_embeds

const baseurl = "https://frembed.fun/"

export async function scrapeFrembed(imdbid, season, episode) {
    if (remote == "true") {
        return(null)
        // frembed does not have any remote providers unfortunately
    }
    let url = ""
    if (episode == 0 || episode == "0") {
        // it is a movie
        url = `${baseurl}/api/film.php?id=${imdbid}`
    } else {
        // it is a series
        url = `${baseurl}/api/serie.php?id=${imdbid}&sa=${season}&epi=${episode}`
    }
    const finalstreams = []

    try {
        const response = await fetch(url);
        if (!response.ok) {
          return(null)
        }
        const text = await response.text();
        const regex = /data-link="([^"]*)"/g;
        const matches = [...text.matchAll(regex)];

        const streamsPromises = matches.map(async (match) => {
            const decryptedurl = Buffer.from(match[1], 'base64').toString('utf-8');
            const decodedurl = decodeURIComponent(decryptedurl);
        
            if (decodedurl.includes("voe.sx")) {
                const url = await voeResolve(new URL(decodedurl));
                return {
                    name: "Stremify FR",
                    type: "url",
                    url: url,
                    title: `frembed - auto (voe.sx)`,
                    behaviorHints: {
                        bingeGroup: `fr_voe`
                    }
                };
        
            } else if (decodedurl.includes("uqload.to") || decodedurl.includes("uqload.co")) {
                const url = await uqloadResolve(new URL(decodedurl));
                return {
                    name: "Stremify FR",
                    type: "url",
                    url: url,
                    title: `frembed - auto (uqload)`,
                    behaviorHints: {
                        proxyHeaders: {"request": { "Referer": "https://uqload.to/" }},
                        notWebReady: true,
                        bingeGroup: 'fr_uqload'
                    }
                };
        
            }
        });
        
        const resolvedStreams = await Promise.all(streamsPromises);
        finalstreams.push(...resolvedStreams.filter(Boolean));
        return finalstreams.filter(stream => stream !== undefined);
        
      } catch (error) {
        return(null)
    }

}