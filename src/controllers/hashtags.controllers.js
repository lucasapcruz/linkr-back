import { connection } from "../database/server.js";

export async function getTrendingHashtags(req, res) {

  try {

    const queryHashtags = await connection.query(`
    SELECT
	    h.name,
	    COUNT(*)
    FROM
	    hashtags h
    GROUP BY
	    h.name
    ORDER BY count DESC
    LIMIT 10
    `);
    const hashtags = queryHashtags.rows;

    res.send(hashtags);
  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }
};
