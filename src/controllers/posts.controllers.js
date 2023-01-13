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
        /* temp table containing all shared posts */
        WITH
        shares_info AS (
          SELECT 
            p.id,
            p.user_id,
            us.image_url,
            us.name,
            p.link,
            p.message,
            r.date,
            p.user_id = $1 AS owner,
            u.name AS sharer_name,
            r.user_id AS sharer_id
          FROM posts p
          JOIN reposts r
          ON p.id = r.post_id
          JOIN users u
          ON r.user_id = u.id
          JOIN users us
	        ON p.user_id = us.id
          WHERE r.user_id = $1
        ),

        /* count how many times posts from the
        shares_info appeared */
        shares_counter AS (
          SELECT s.id, COUNT(s.id)
          FROM shares_info s
          GROUP BY s.id
        ),

        /* join the temp shares_info table
        and the shares_counter table */
        shares AS (
          SELECT 
            s.id, s.user_id, s.image_url, s.name, s.link, s.message, s.date, s.owner,
            JSONB_BUILD_OBJECT(
              'sharerId', s.sharer_id,
              'sharerName', s.sharer_name,
              'shareCount', COALESCE(c.count,0)
            ) AS shareInfo
          FROM shares_info s
          LEFT JOIN shares_counter c
          ON s.id = c.id
        ),

        /* create a similar table with the original posts
        and adds the columns (shareInfo) needed for the later union */
        original_posts AS (
          SELECT 
            p.id,
            p.user_id,
            u.image_url,
            u.name,
            p.link,
            p.message,
            p.date,
            p.user_id = $1 AS owner,
            JSONB_BUILD_OBJECT(
                'sharerId', NULL,
                'sharerName', NULL,
                'shareCount', COALESCE(c.count,0)
              ) AS shareInfo
          FROM posts p
          JOIN users u
          ON p.user_id = u.id
          LEFT JOIN shares_counter c
          ON p.id = c.id
          WHERE p.user_id = $1          
        )

        SELECT s.* 
        FROM shares s 
        UNION
        SELECT p.* 
        FROM original_posts p
        ORDER BY date DESC
        OFFSET null
        LIMIT null;
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
        /* count how many times posts from the
        shares_info appeared */
        WITH
		    shares_counter AS (
          SELECT r.post_id AS id, COUNT(r.post_id)
          FROM reposts r
          GROUP BY r.post_id
        ),

        /* create a similar table with the original posts
        and adds the columns (shareInfo) needed for the later union */
        original_posts AS (
          SELECT 
          p.id,
          p.user_id,
          u.image_url,
          u.name,
          p.link,
          p.message,
          p.date,
          p.user_id = $1 AS owner,
          JSONB_BUILD_OBJECT(
            'sharerId', NULL,
            'sharerName', NULL,
            'shareCount', COALESCE(c.count,0)
            ) AS shareInfo
          FROM posts p
          JOIN users u
          ON p.user_id = u.id
          LEFT JOIN shares_counter c
          ON p.id = c.id
        )

        SELECT p.* 
        FROM original_posts p
        WHERE id IN (SELECT h.post_id FROM hashtags h WHERE h.name = $2)
        ORDER BY date DESC
        OFFSET null
        LIMIT null;
      
      `,
        [userInfo.user_id, hashtag]
      );
    } else {
      queryPosts = await connection.query(
        `
        /* temp table containing all shared posts */
        WITH
        shares_info AS (
          SELECT 
            p.id,
            p.user_id,
            us.image_url,
            us.name,
            p.link,
            p.message,
            r.date,
            p.user_id = $1 AS owner,
            u.name AS sharer_name,
            r.user_id AS sharer_id
          FROM posts p
          JOIN reposts r
          ON p.id = r.post_id
          JOIN users u
          ON r.user_id = u.id
          JOIN users us
	        ON p.user_id = us.id
        ),

        /* count how many times posts from the
        shares_info appeared */
        shares_counter AS (
          SELECT s.id, COUNT(s.id)
          FROM shares_info s
          GROUP BY s.id
        ),

        /* join the temp shares_info table
        and the shares_counter table */
        shares AS (
          SELECT 
            s.id, s.user_id, s.image_url, s.name, s.link, s.message, s.date, s.owner,
            JSONB_BUILD_OBJECT(
              'sharerId', s.sharer_id,
              'sharerName', s.sharer_name,
              'shareCount', COALESCE(c.count,0)
            ) AS shareInfo
          FROM shares_info s
          LEFT JOIN shares_counter c
          ON s.id = c.id
        ),

        /* create a similar table with the original posts
        and adds the columns (shareInfo) needed for the later union */
        original_posts AS (
          SELECT 
            p.id,
            p.user_id,
            u.image_url,
            u.name,
            p.link,
            p.message,
            p.date,
            p.user_id = $1 AS owner,
            JSONB_BUILD_OBJECT(
                'sharerId', NULL,
                'sharerName', NULL,
                'shareCount', COALESCE(c.count,0)
              ) AS shareInfo
          FROM posts p
          JOIN users u
          ON p.user_id = u.id
          LEFT JOIN shares_counter c
          ON p.id = c.id
          
        )

        SELECT s.* 
        FROM shares s
        WHERE shareInfo->>'sharerId'::text IN (SELECT following_id::text FROM followings WHERE user_id = $1)
        UNION
        SELECT p.* 
        FROM original_posts p
        WHERE user_id IN (SELECT following_id FROM followings WHERE user_id = $1)
        ORDER BY date DESC
        OFFSET null
        LIMIT null;
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
  const { postId } = req.body;
  let queryComments;
  let data = {};

  try {
    if (postId) {
      queryComments = await connection.query(
        `
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
      `,
        [postId]
      );

      const queryUser = await connection.query(
        `
        SELECT user_id FROM posts WHERE posts.id = $1;
      `,
        [postId]
      );

      const userId = queryUser.rows[0].user_id;

      const queryFollowing = await connection.query(
        `
        SELECT 
          f.following_id 
        FROM 
          followings AS f
        WHERE
          f.user_id = $1;
      `,
        [userId]
      );

      data.followings = queryFollowing.rows.map((f) => f.following_id);
      data.userId = userId;
    } else {
      queryComments = await connection.query(`
      SELECT 
        post_id AS postId, 
        COUNT(post_id) AS countComment
      FROM
        comments
      GROUP BY
        post_id;
      `);
    }

    data.comments = queryComments.rows;

    res.send(data);
  } catch (error) {
    console.log(error.message);
    res.sendStatus(500);
  }
}
