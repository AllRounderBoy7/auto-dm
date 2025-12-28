import { supabase } from './supabase'

export async function getPosts() {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function addPost(content: string) {
  if (!content.trim()) return
  await supabase.from('posts').insert({ content })
}

export async function addReply(postId: number, type: string) {
  await supabase.from('replies').insert({
    post_id: postId,
    type
  })
}
