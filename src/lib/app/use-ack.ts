/**
 * The recreational-use acknowledgement asked before a league is first imported. Bump the version if
 * the wording changes. Stored with the league (version + time only), and in the browser so the
 * same visitor isn't asked again; nothing about the person is kept.
 */
export const USE_ACK_VERSION = "2026-11-15";
export const USE_ACK_TEXT =
  "I'm using Rafterlore for recreational and informational purposes only, not to facilitate sports wagering.";
export const USE_ACK_KEY = "rl:use-ack";
