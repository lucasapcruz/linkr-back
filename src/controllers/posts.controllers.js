import { connection } from "../database/server.js";
import { getLinkPreview, getPreviewFromContent } from "link-preview-js";

export async function createPost (req, res) {
  const { link, message } = res.locals.data;

  // Filter Hashtags
  const words = message.split(" ");
  const hashtags = words.filter(word => word[0] === "#")
  .map(word => word.replace("#", ""));
  
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
    , [userId, link ? link : "", message]);
    
    // Hashtags
    const postId = queryPost.rows[0].id;
    for (let i = 0; i < hashtags.length; i++) {
      const name = hashtags[i];
      await connection.query(`
        INSERT INTO hashtags (name, post_id) VALUES ($1, $2)`
      , [name, postId]);
    }

    res.sendStatus(201);
  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }
};

export async function getPosts (req, res) {

  try {
    const queryPosts = await connection.query(`
      SELECT p.id, u.image_url, u.name, p.link, p.message FROM posts AS p
      JOIN users AS u ON p.user_id = u.id
      ORDER BY p.date DESC
      LIMIT 20
    `);
    const posts = queryPosts.rows;

    for (let i = 0; i < posts.length; i++) {
      const e = posts[i];
      if (e.link) {
        const { title, description, url, images } = await getLinkPreview(e.link);
        e.link = { title, description, url, image: images[0] };
      }
    }
    
    res.send(posts);
  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }
};
