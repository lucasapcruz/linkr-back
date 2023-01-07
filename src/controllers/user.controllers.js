import { connection } from "../database/server.js";
import bcrypt from "bcrypt";
import { v4 as createToken } from "uuid";

export async function Signup(req, res) {
  const { name, email, password, image_url } = res.locals.data;
  try {
    const query = await connection.query(
      "SELECT * FROM users WHERE email = $1;",
      [email]
    );
    if (query.rowCount != 0) return res.sendStatus(409);

    const passwordcrypt = bcrypt.hashSync(password, 10);
    const newpassword = passwordcrypt;

    await connection.query(
      'INSERT INTO users ("name", "email", "password", "image_url") VALUES ($1, $2, $3, $4)',
      [name, email, newpassword, image_url]
    );

    res.sendStatus(201);
  } catch (error) {
    console.log(error.message);
    res.sendStatus(500);
  }
}

export async function Signin(req, res) {
  const { email, password } = res.locals.data;

  try {
    const query = await connection.query("SELECT * FROM users WHERE email=$1", [
      email,
    ]);
    if (query.rowCount === 0) return res.sendStatus(401);
    const user = query.rows[0];

    const hashPassword = bcrypt.compareSync(password, query.rows[0].password);
    if (!hashPassword) return res.sendStatus(401);

    const newToken = createToken();
    await connection.query(
      `INSERT INTO sessions ("user_id", token) VALUES ($1, $2);`,
      [user.id, newToken]
    );

    res.send({ 
      token: newToken,
      name: user.name,
      pictureUrl: user.image_url
    });
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
}

export async function find(req, res) {
  const { id } = req.params;

  try {
    let user = await connection.query(
      `
        SELECT id, name, image_url AS "imageUrl"
        FROM users
        WHERE users.id=$1
    `,
      [id]
    );

    res.send(user.rows[0]);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
}

export async function findAll(req, res) {
  const { name } = req.query;

  try {
    const user = await connection.query(
      `
        SELECT id, name, image_url AS "imageUrl"
        FROM users
        WHERE LOWER(name) LIKE $1
    `,
      [`${name}%`]
    );

    if (!user.rowCount)
      return res.status(404).send({ message: "Nenhum usuário encontrado" });

    res.send(user.rows);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
}

export async function deleteUser (req, res) {
  const { token } = res.locals;
  
  try {
    // Token > User
    const queryUser = await connection.query(
      `
      SELECT u.id FROM users AS u
      JOIN sessions AS s ON u.id = s.user_id
      WHERE s.token = $1
    `,
      [token]
    );
    const userId = queryUser.rows[0].id;

    await connection.query(`DELETE FROM sessions WHERE user_id=$1`, [userId]);
    res.sendStatus(200);

  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }
};
