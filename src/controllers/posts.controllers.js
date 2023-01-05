import { connection } from "../database/server.js";
import { getLinkPreview } from "link-preview-js";

export async function createPost(req, res) {
  const { link, message } = res.locals.data;

  try {
    // Token > User
    const queryUser = await connection.query(`
      SELECT u.id FROM users AS u
      JOIN sessions AS s ON u.id = s.user_id
      WHERE s.token = $1
    `, [res.locals.token]);
    const userId = queryUser.rows[0].id;

    // Post
    const queryPost = await connection.query(`
      INSERT INTO posts (user_id, link, message) VALUES ($1, $2, $3) RETURNING id`
      , [userId, link, message || ""]);

    // Hashtags
    if (message) {
      const words = message.split(" ");
      const hashtags = words.filter(word => word[0] === "#")
        .map(word => word.replace("#", ""));

      const postId = queryPost.rows[0].id;
      for (let i = 0; i < hashtags.length; i++) {
        const name = hashtags[i];
        await connection.query(`
          INSERT INTO hashtags (name, post_id) VALUES ($1, $2)`
          , [name, postId]);
      }
    }

    res.sendStatus(201);
  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }
};

export async function getPosts(req, res) {

  const { hashtag } = req.query

  try {
    // Token > User
    const queryUser = await connection.query(`
      SELECT u.id FROM users AS u
      JOIN sessions AS s ON u.id = s.user_id
      WHERE s.token = $1
    `, [res.locals.token]);
    const userId = queryUser.rows[0].id;

    let queryPosts;
    if (!hashtag) {
      queryPosts = await connection.query(`
      SELECT p.id, u.id AS user_id, u.image_url, u.name, p.link, p.message FROM posts AS p
      JOIN users AS u ON p.user_id = u.id
      ORDER BY p.date DESC
      LIMIT 20
    `);
    } else {
      queryPosts = await connection.query(`
      SELECT p.id, u.id AS user_id, u.image_url, u.name, p.link, p.message
      FROM posts AS p
      JOIN users AS u ON p.user_id = u.id
      WHERE p.id IN (
	      SELECT h.post_id 
        FROM hashtags h
        WHERE h."name" = $1)
      ORDER BY p.date DESC
      LIMIT 20
    `, [hashtag]);
    }
    const posts = queryPosts.rows;

    for (let i = 0; i < posts.length; i++) {
      const e = posts[i];
      e.owner = (e.user_id === userId);
      delete e.user_id;
      if (e.link) {
        const { title, description, url, images, favicons } = await getLinkPreview(e.link);
        e.link = {
          title,
          description,
          url,
          image: images.length ? images[0] : favicons[0]
        };
      }
    }

    res.send(posts);
  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }
};

export async function updatePost(req, res) {
  const { message, id } = req.body;

  try {
    await connection.query(`
      UPDATE posts SET message=$1 WHERE id=$2
    `, [message, id]);

    res.sendStatus(200);
  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }
};

export async function deletePost(req, res) {
  const { id } = req.params;
  const { token } = res.locals;

  try {
    const isPostFromUser = await connection.query(`
      SELECT p.id FROM posts p
      JOIN users u ON p.user_id = u.id
      JOIN sessions s ON u.id = s.user_id
      WHERE s.token = $1 AND p.id = $2
    `, [token, id]);
    if (!isPostFromUser.rowCount) return res.sendStatus(401);

    await connection.query(`DELETE FROM posts WHERE id=$1`, [id])
    res.sendStatus(204);
  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }
};

export async function likePost(req, res) {
  const { postId } = req.body;

  const queryUser = await connection.query(
    `SELECT u.id 
    FROM users AS u 
    JOIN sessions AS s 
    ON u.id = s.user_id 
    WHERE s.token = $1`,
    [res.locals.token]
  );

  const userId = queryUser.rows[0].id;

  const queryLikes = await connection.query(
    `SELECT *
    FROM likes
    WHERE user_id=$1 AND post_id=$2;`,
    [userId, postId]
  );

  if (queryLikes.rows.length > 0) {
    console.log(userId);
    await connection.query(
      `DELETE FROM likes
      WHERE user_id=$1 AND post_id=$2;`,
      [userId, postId]
    );
  } else {
    await connection.query(
      `INSERT INTO likes (post_id, user_id)
      VALUES ($1, $2);`,
      [postId, userId]
    );
  }

  return res.sendStatus(201);
};

export async function getPostLikes(req, res) {
  const queryLikes = await connection.query(
    `SELECT post_id, user_id FROM likes;`,
  );

  const likes = queryLikes.rows;

  return res.status(200).send(likes);
}