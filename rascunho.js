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
  };

//   console.log(err.message);
//   res.sendStatus(500);

export async function postComment(req, res) {
  const token = res.locals.token
  const { postId, message } = res.locals.data

  try {
    const query = await connection.query(`
      SELECT s.user_id
      FROM sessions AS s
      WHERE s.token = $1;
    `, [token])
      
    const userId = query.rows[0].user_id
        
    await connection.query(`
      INSERT 
      INTO comments
        (post_id, user_id, message)
      VALUES
        ($1, $2, $3);  
    `, [postId, userId, message])

    res.sendStatus(200)

  } catch (error) {
    console.log(error.message)
    res.sendStatus(500)
  }

}