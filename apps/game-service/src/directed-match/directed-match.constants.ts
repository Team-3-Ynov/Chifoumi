export const CLAIM_DIRECTED_PLAYERS_SCRIPT = `
local queueKey = KEYS[1]
local pairLockKey = ARGV[1]
local matchId = ARGV[2]
local userA = ARGV[3]
local userB = ARGV[4]
local matchByUserPrefix = ARGV[5]
local metaPrefix = ARGV[6]
local tournamentMatchKey = ARGV[7]
local matchTtl = tonumber(ARGV[8])

if redis.call("EXISTS", pairLockKey) == 0 then
  return 0
end

if redis.call("EXISTS", tournamentMatchKey) == 1 then
  redis.call("DEL", pairLockKey)
  return 2
end

if redis.call("EXISTS", matchByUserPrefix .. userA) == 1 then
  redis.call("DEL", pairLockKey)
  return 0
end
if redis.call("EXISTS", matchByUserPrefix .. userB) == 1 then
  redis.call("DEL", pairLockKey)
  return 0
end

redis.call("ZREM", queueKey, userA, userB)
redis.call("DEL", metaPrefix .. userA, metaPrefix .. userB)
redis.call("SETEX", matchByUserPrefix .. userA, matchTtl, matchId)
redis.call("SETEX", matchByUserPrefix .. userB, matchTtl, matchId)
redis.call("SETEX", tournamentMatchKey, matchTtl, matchId)
redis.call("DEL", pairLockKey)

return 1
`;
