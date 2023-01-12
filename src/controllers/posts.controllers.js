import { connection } from "../database/server.js";
import { getLinkPreview } from "link-preview-js";

export async function createPost(req, res) {
  const { link, message } = res.locals.data;

  try {
    // Token > User
    const queryUser = await connection.query(
      `
      SELECT u.id FROM users AS u
      JOIN sessions AS s ON u.id = s.user_id
      WHERE s.token = $1
    `,
      [res.locals.token]
    );
    const userId = queryUser.rows[0].id;

    // Post
    const queryPost = await connection.query(
      `
      INSERT INTO posts (user_id, link, message) VALUES ($1, $2, $3) RETURNING id`,
      [userId, link, message || ""]
    );

    // Hashtags
    if (message) {
      const words = message.split(" ");
      const hashtags = words
        .filter((word) => word[0] === "#")
        .map((word) => word.replace("#", ""));

      const postId = queryPost.rows[0].id;
      for (let i = 0; i < hashtags.length; i++) {
        const name = hashtags[i];
        await connection.query(
          `
          INSERT INTO hashtags (name, post_id) VALUES ($1, $2)`,
          [name, postId]
        );
      }
    }

    res.sendStatus(201);
  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }
}

export async function getPosts(req, res) {
  const { userInfo } = res.locals;
  const { hashtag } = req.query;
  const { id } = req.params;

  try {
    const userId = userInfo.user_id;

    let data = {};
    let queryPosts;

    if (id) {
      queryPosts = await connection.query(
        `
          WITH tablejoin AS (
            SELECT
              p.id,
            p.user_id,
            P.message,
            p.link,
              r.user_id AS sharer_id,
            p.date,
              r.date AS repost_date,
            u.name AS sharer_name
            FROM posts p
            LEFT JOIN reposts r
            ON p.id = r.post_id
            LEFT JOIN users u 
			      ON r.user_id = u.id
            )
          , 
          shares AS (
            SELECT 
            r.post_id AS shared_id,
            COUNT(r.post_id) AS share_count
            FROM posts p
            JOIN reposts r
            ON p.id = r.post_id
            GROUP BY r.post_id
            )

          SELECT 
            t.id, t.user_id, u.image_url, u.name, t.message, t.link,
            json_build_object(
              'sharerId', CASE WHEN t.user_id = $1
                  THEN NULL ELSE t.sharer_id END,
              'sharerName', t.sharer_name,
              'shareCount', s.share_count
            ) AS "shareInfo",
            CASE WHEN t.repost_date IS NOT NULL
                THEN t.repost_date
                ELSE t.date 
            END AS date,
            t.user_id = $1 AS "owner"

          FROM tablejoin t
          LEFT JOIN shares s
          ON t.id = s.shared_id
          JOIN users u
          ON t.user_id = u.id
          WHERE t.user_id = $1 OR t.sharer_id = $1
          ORDER BY date DESC;
        `,
        [id]
      );

      const queryFollowing = await connection.query(
        `
        SELECT * FROM followings WHERE user_id = $1 AND following_id = $2
      `,
        [userId, id]
      );
      data.following = queryFollowing.rowCount ? true : false;

      const queryName = await connection.query(
        "SELECT name FROM users WHERE id = $1",
        [id]
      );
      data.name = queryName.rows[0].name;
    } else if (hashtag) {
      queryPosts = await connection.query(
        `
        WITH tablejoin AS (
          SELECT
          p.id,
          p.user_id,
          P.message,
          p.link,
            r.user_id AS sharer_id,
          p.date,
            r.date AS repost_date,
			    u,name AS sharer_name
          FROM posts p
          LEFT JOIN reposts r
          ON p.id = r.post_id
          LEFT JOIN users u
          ON r.user_id = u.id
          )
        ,
        shares AS (
          SELECT 
          r.post_id AS shared_id,
          COUNT(r.post_id) AS share_count
          FROM posts p
          JOIN reposts r
          ON p.id = r.post_id
          GROUP BY r.post_id
          )

        SELECT 
          t.id, t.user_id, u.image_url, u.name, t.message, t.link,
          json_build_object(
            'sharerId', NULL,
            'shareCount', COALESCE(s.share_count,0),
            'sharerName', NULL
          ) AS "shareInfo",
          CASE WHEN t.repost_date IS NOT NULL
              THEN t.repost_date
              ELSE t.date 
          END AS date,
          t.user_id = $2 AS "owner"

          FROM tablejoin t
          LEFT JOIN shares s
          ON t.id = s.shared_id
          JOIN users u
          ON t.user_id = u.id
		      WHERE t.id IN (SELECT h.post_id FROM hashtags h WHERE h.name = $1)
          ORDER BY date DESC;
      
      `,
        [hashtag, userInfo.user_id]
      );
    } else {
      queryPosts = await connection.query(
        `
        WITH tablejoin AS (
          SELECT
          p.id,
          p.user_id,
          P.message,
          p.link,
            r.user_id AS sharer_id,
          p.date,
            r.date AS repost_date,
          u,name AS sharer_name
          FROM posts p
          LEFT JOIN reposts r
          ON p.id = r.post_id
          LEFT JOIN users u
          ON r.user_id = u.id
        )
        , 
        shares AS (
          SELECT 
          r.post_id AS shared_id,
          COUNT(r.post_id) AS share_count
          FROM posts p
          JOIN reposts r
          ON p.id = r.post_id
          GROUP BY r.post_id
          )

        SELECT 
          t.id, t.user_id, u.image_url, u.name, t.message, t.link,
          json_build_object(
            'sharerId', t.sharer_id,
            'shareCount', COALESCE(s.share_count,0),
            'sharerName', t.sharer_name
          ) AS "shareInfo",
          CASE WHEN t.repost_date IS NOT NULL
              THEN t.repost_date
              ELSE t.date 
          END AS date,
          t.user_id = $1 AS "owner"
        
        FROM tablejoin t
        LEFT JOIN shares s
        ON t.id = s.shared_id
        JOIN users u
        ON t.user_id = u.id
        WHERE t.user_id IN (
          SELECT following_id FROM followings WHERE user_id = $1)
        OR t.sharer_id IN (
          SELECT following_id FROM followings WHERE user_id = $1)
        ORDER BY date DESC;
  `,
        [userId]
      );

      const followQuery = await connection.query(
        `
        SELECT * FROM followings WHERE user_id = $1
      `,
        [userId]
      );
      data.localFollowing = followQuery.rowCount;
    }
    const posts = queryPosts.rows;

    for (let i = 0; i < posts.length; i++) {
      const e = posts[i];
      if (e.link) {
        const { title, description, url, images, favicons } =
          await getLinkPreview(e.link);
        e.link = {
          title,
          description,
          url,
          image: images.length ? images[0] : favicons[0],
        };
      }
    }

    data.posts = posts;
    console.log(posts)
    res.send(data);
  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }
}

export async function repost(req, res) {
  const { id } = req.params;
  const { userInfo } = res.locals;

  try {
    await connection.query(
      `
      INSERT INTO reposts
      (post_id, user_id)
      VALUES ($1, $2);
    `,
      [id, userInfo.user_id]
    );

    res.sendStatus(201);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
}

export async function updatePost(req, res) {
  const { message, id } = req.body;

  try {
    // Delete old hashtags
    await connection.query(`DELETE FROM hashtags WHERE post_id=$1`, [id]);

    // Insert new hashtags
    const words = message.split(" ");
    const hashtags = words
      .filter((word) => word[0] === "#")
      .map((word) => word.replace("#", ""));
    for (let i = 0; i < hashtags.length; i++) {
      const name = hashtags[i];
      await connection.query(
        `
        INSERT INTO hashtags (name, post_id) VALUES ($1, $2)
      `,
        [name, id]
      );
    }

    // Update post message
    await connection.query(
      `
      UPDATE posts SET message=$1 WHERE id=$2
    `,
      [message, id]
    );

    res.sendStatus(200);
  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }
}

export async function deletePost(req, res) {
  const { id } = req.params;
  const { token } = res.locals;

  try {
    const isPostFromUser = await connection.query(
      `
      SELECT p.id FROM posts p
      JOIN users u ON p.user_id = u.id
      JOIN sessions s ON u.id = s.user_id
      WHERE s.token = $1 AND p.id = $2
    `,
      [token, id]
    );
    if (!isPostFromUser.rowCount) return res.sendStatus(401);

    await connection.query(`DELETE FROM hashtags WHERE post_id=$1`, [id]);
    await connection.query(`DELETE FROM likes WHERE post_id=$1`, [id]);
    await connection.query(`DELETE FROM posts WHERE id=$1`, [id]);
    res.sendStatus(204);
  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }
}

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
}

export async function getPostLikes(req, res) {
  const queryLikes = await connection.query(
    `SELECT posts.id AS "postId",
    json_agg(users.name) AS "usersWhoLiked"
    FROM likes 
    JOIN posts ON likes.post_id = posts.id
    JOIN users ON likes.user_id = users.id 
    GROUP BY posts.id
    ORDER BY posts.id ASC;`
  );

  res.status(200).send(queryLikes.rows);
}

export async function postComment(req, res) {
  const token = res.locals.token;
  const { postId, message } = res.locals.data;

  try {
    const query = await connection.query(
      `
      SELECT s.user_id
      FROM sessions AS s
      WHERE s.token = $1;
    `,
      [token]
    );

    console.log(query);

    const userId = query.rows[0].user_id;

    await connection.query(
      `
      INSERT 
      INTO comments
        (post_id, user_id, message)
      VALUES
        ($1, $2, $3);  
    `,
      [postId, userId, message]
    );

    res.sendStatus(201);
  } catch (error) {
    console.log(error.message);
    res.sendStatus(500);
  }
}

export async function getComment(req, res) {
  const { postId } = req.body
  let queryComments
  let data = {}
  
  try{
    if(postId){
      queryComments = await connection.query(`
      SELECT 
        c.user_id, u.name, u.image_url, c.message
      FROM  
        comments AS c
      JOIN
        users AS u ON c.user_id = u.id
      WHERE
        c.post_id = $1
      ORDER BY
        c.id DESC;
      `, [postId])

      const queryUser = await connection.query(`
        SELECT user_id FROM posts WHERE posts.id = $1;
      `, [postId])

      const userId = queryUser.rows[0].user_id      

      const queryFollowing = await connection.query(`
        SELECT 
          f.following_id 
        FROM 
          followings AS f
        WHERE
          f.user_id = $1;
      `, [userId]) 
      
       data.followings = queryFollowing.rows.map( f => f.following_id)
       data.userId = userId

    }else{
      queryComments = await connection.query(`
      SELECT 
        post_id AS postId, 
        COUNT(post_id) AS countComment
      FROM
        comments
      GROUP BY
        post_id;
      `)
    }

    data.comments = queryComments.rows
    
    res.send(data)
  } catch(error){
    console.log(error.message)
    res.sendStatus(500)
  }
}