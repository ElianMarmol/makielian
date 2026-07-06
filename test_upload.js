import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://cvhqavwvolazynnvvlrw.supabase.co';
const supabaseKey = 'sb_publishable_qod2Vd1QjC7Kf8OpIWKNtw_hEJKh1GZ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpload() {
  const fileContent = fs.readFileSync('C:\\Users\\tanza\\Downloads\\album-aventuras-backup-2026-07-06.json', 'utf8');
  const data = JSON.parse(fileContent);
  const firstUrl = data[0].urls[0];
  
  if (!firstUrl.startsWith('data:')) {
    console.log('Not a data URL');
    return;
  }
  
  const base64Data = firstUrl.split(',')[1];
  const buffer = Buffer.from(base64Data, 'base64');
  
  const { data: uploadData, error } = await supabase.storage
    .from('album_photos')
    .upload('test_image.jpg', buffer, {
      contentType: 'image/jpeg'
    });
    
  if (error) {
    console.error('Upload Error:', error);
  } else {
    console.log('Upload Success:', uploadData);
  }
}

testUpload();
