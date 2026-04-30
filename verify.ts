import axios from 'axios';

async function verify() {
  try {
    const res = await axios.get('http://localhost:8000/api/v1/student/tests?categoryId=bf7da285-0441-41b3-b5ea-75de3c44af29', {
      headers: {
        'Authorization': 'Bearer DUMMY', // Will probably fail 401, wait!
      }
    });
    console.log(res.data);
  } catch (err: any) {
    console.error(err.response?.status, err.response?.data || err.message);
  }
}
verify();
