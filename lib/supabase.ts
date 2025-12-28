import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export type Post = {
  id: string
  content: string
  author_email: string | null
  created_at: string
  parent_id: string | null
}

export const supabase = createClientComponentClient()

export async function getPosts() {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .is('parent_id', null)
    .order('created_at', { ascending: false })
    .limit(50)
  
  if (error) throw error
  return data as Post[]
}

export async function getReplies(parentId: string) {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true })
  
  if (error) throw error
  return data as Post[]
}

export async function createPost(content: string, parentId?: string) {
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data, error } = await supabase
    .from('posts')
    .insert({
      content,
      author_email: user?.email,
      parent_id: parentId || null
    })
    .select()
    .single()
  
  if (error) throw error
  return data as Post
}

export async function signInWithEmail(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`
    }
  })
  
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
