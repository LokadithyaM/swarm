"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Heart, MessageCircle, Repeat2, Share, Bot, User, Sparkles } from "lucide-react"
import { useRef } from "react"

interface Reply {
  _id: string
  postId: string
  parentCommentId?: string | null
  authorId: Author
  content: string
  comments: Reply[]
  timestamp: string
  likeCount: number
  createdAt: string
  updatedAt: string
}

interface Author {
  _id: string
  username: string
}

interface Post {
  _id: string
  content: string
  authorId: Author
  createdAt: string
  updatedAt: string
  timestamp: string
  likeCount: number
  replyCount: number
  comments: Reply[]
  __v: number
}

const API_BASE = "http://localhost:8080/api"

export default function SocialFeed() {
  const [posts, setPosts] = useState<Post[]>([])
  const [newPost, setNewPost] = useState("")
  const [isPosting, setIsPosting] = useState(false)
  const [replyInputs, setReplyInputs] = useState<{ [key: string]: string }>({})
  const [showReplyInput, setShowReplyInput] = useState<{ [key: string]: boolean }>({})
  const [isReplying, setIsReplying] = useState<{ [key: string]: boolean }>({})
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())
  const [likedReplies, setLikedReplies] = useState<Set<string>>(new Set())
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await fetch(`${API_BASE}/posts`)
        const data = await res.json()
        if (data.success) {
          console.log(data);
          setPosts(data.posts)
        }
      } catch (error) {
        console.error("Failed to fetch posts:", error)
      }
    }
    fetchPosts()

    // WebSocket for real-time updates
    wsRef.current = new WebSocket("ws://localhost:8080")
    wsRef.current.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === "comment") {
        setPosts(prev =>
          prev.map(post =>
            post._id === msg.postId
              ? { ...post, comments: [...(post.comments || []), msg.comment] }
              : post
          )
        )
      } else if (msg.type === "post") {
        setPosts((prev) => [msg.post, ...prev])
      }
    }

    return () => wsRef.current?.close()
  }, [])

  const handlePost = async () => {
    if (!newPost.trim()) return

    setIsPosting(true)
    try {
      console.log("entering post");


        wsRef.current?.send(
          JSON.stringify({
            type: "newPost",
            authorId: "68a6ea1b9030bcf69c3c965b",
            content: newPost,
            authorType: "User",
          }),
        )
        setNewPost("")
    } catch (error) {
      console.error("Failed to create post:", error)
    } finally {
      setIsPosting(false)
    }
  }

  const toggleLike = async (postId: string) => {
    const isLiked = likedPosts.has(postId)

    try {
      if (isLiked) {
        await fetch(`${API_BASE}/likes`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: "user", // You might want to get this from auth context
            targetId: postId,
            targetType: "post",
          }),
        })
        setLikedPosts((prev) => {
          const newSet = new Set(prev)
          newSet.delete(postId)
          return newSet
        })
      } else {
        await fetch(`${API_BASE}/likes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: "user", // You might want to get this from auth context
            targetId: postId,
            targetType: "post",
          }),
        })
        setLikedPosts((prev) => new Set([...prev, postId]))
      }

      // Update post like count locally
      setPosts((prev) =>
        prev.map((post) =>
          post._id === postId ? { ...post, likeCount: isLiked ? post.likeCount - 1 : post.likeCount + 1 } : post,
        ),
      )
    } catch (error) {
      console.error("Failed to toggle like:", error)
    }
  }

  const toggleReplyLike = async (postId: string, replyId: string) => {
    const isLiked = likedReplies.has(replyId)

    try {
      if (isLiked) {
        await fetch(`${API_BASE}/likes`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: "user",
            targetId: replyId,
            targetType: "comment",
          }),
        })
        setLikedReplies((prev) => {
          const newSet = new Set(prev)
          newSet.delete(replyId)
          return newSet
        })
      } else {
        await fetch(`${API_BASE}/likes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: "user",
            targetId: replyId,
            targetType: "comment",
          }),
        })
        setLikedReplies((prev) => new Set([...prev, replyId]))
      }

      // Update reply like count locally
      setPosts((prev) =>
        prev.map((post) => {
          if (post._id === postId) {
            const updateReplyLikes = (comments: Reply[]): Reply[] => {
              return comments.map((reply) => {
                if (reply._id === replyId) {
                  return {
                    ...reply,
                    likeCount: isLiked ? reply.likeCount - 1 : reply.likeCount + 1,
                  }
                }
                if (reply.comments) {
                  return { ...reply, comments: updateReplyLikes(reply.comments) }
                }
                return reply
              })
            }
            return { ...post, comments: updateReplyLikes(post.comments) }
          }
          return post
        }),
      )
    } catch (error) {
      console.error("Failed to toggle reply like:", error)
    }
  }

  const toggleReplyInput = (id: string) => {
    setShowReplyInput((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  function buildCommentTree(comments: Reply[]): Reply[] {
    const map: Record<string, Reply & { comments: Reply[] }> = {}
    const roots: (Reply & { comments: Reply[] })[] = []
  
    // Init all with empty comments[]
    comments.forEach(c => {
      map[c._id] = { ...c, comments: [] }
    })
  
    // Attach children
    comments.forEach(c => {
      if (c.parentCommentId && map[c.parentCommentId]) {
        map[c.parentCommentId].comments.push(map[c._id])
      } else {
        roots.push(map[c._id])
      }
    })
  
    return roots
  }
  

  const handleReply = async (postId: string, parentReplyId?: string) => {
    const replyKey = parentReplyId ? `${postId}-${parentReplyId}` : postId
    const content = replyInputs[replyKey]?.trim()
    if (!content) return

    setIsReplying((prev) => ({ ...prev, [replyKey]: true }))
    console.log("commented");

    try {
        wsRef.current?.send(
          JSON.stringify({
            type: "newReply",
            postId,
            parentReplyId,
            content,
            authorId: "68a6ea1b9030bcf69c3c965b",
          }),
        )
        

        setReplyInputs((prev) => ({ ...prev, [replyKey]: "" }))
        setShowReplyInput((prev) => ({ ...prev, [replyKey]: false }))
    } catch (error) {
      console.error("Failed to create reply:", error)
    } finally {
      setIsReplying((prev) => ({ ...prev, [replyKey]: false }))
    }
  }

  const formatTime = (date: string | Date) => {
      if (!date) return "now"
    const d = typeof date === "string" ? new Date(date) : date
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)

    if (minutes < 1) return "now"
    if (minutes < 60) return `${minutes}m`
    if (hours < 24) return `${hours}h`
    return d.toLocaleDateString()
  }

  const sortReplies = (comments: Reply[]): Reply[] => {
    return [...comments]
      .sort((a, b) => {
        const getTime = (timestamp: string | Date) => {
          if (typeof timestamp === "string") {
            const d = new Date(timestamp)
            return isNaN(d.getTime()) ? 0 : d.getTime()
          } else if (timestamp instanceof Date) {
            return timestamp.getTime()
          }
          return 0
        }

        const timeA = getTime(a.timestamp)
        const timeB = getTime(b.timestamp)

        return timeA - timeB
      })
      .map((reply) => ({
        ...reply,
        comments: reply.comments ? sortReplies(reply.comments) : [],
      }))
  }
  const getIndent = (depth: number) => {
    const maxIndent = 2;      // how far right it can go (px)
    const curve = 100;         // smaller = slower curve, larger = faster
    return maxIndent * (1 - Math.exp(-curve * depth));
  };
  
  
  
  

  
  const renderReplies = (comments: Reply[], postId: string, depth = 0) => {
    const sortedReplies = sortReplies(comments)

    return sortedReplies.map((reply) => (
      <div
        key={reply._id}
        className="flex gap-3 border-l-2 border-muted"
        style={{ paddingLeft: `${getIndent(depth)}px` }}
      >

        <Avatar className="w-6 h-6">
          <AvatarFallback className={reply.authorId?.username === "gemini" ? "bg-blue-100" : ""}>
            {reply.authorId?.username === "gemini" ? (
              <Bot className="w-3 h-3 text-blue-600" />
            ) : (
              <User className="w-3 h-3" />
            )}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{reply.authorId?.username}</span>
            <span className="text-muted-foreground text-xs">{formatTime(reply.timestamp)}</span>
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap mb-2">{reply.content}</p>

          <div className="flex items-center gap-4 text-muted-foreground mb-2">
            <button
              onClick={() => toggleReplyInput(`${postId}-${reply._id}`)}
              className="flex items-center gap-1 hover:text-blue-500 transition-colors"
            >
              <MessageCircle className="w-3 h-3" />
              <span className="text-xs">{reply.comments?.length || 0}</span>
            </button>

            <button className="flex items-center gap-1 hover:text-green-500 transition-colors">
              <Repeat2 className="w-3 h-3" />
            </button>

            <button
              onClick={() => toggleReplyLike(postId, reply._id)}
              className={`flex items-center gap-1 transition-colors ${
                likedReplies.has(reply._id) ? "text-red-500" : "hover:text-red-500"
              }`}
            >
              <Heart className={`w-3 h-3 ${likedReplies.has(reply._id) ? "fill-current" : ""}`} />
              <span className="text-xs">{reply.likeCount}</span>
            </button>

            <button className="flex items-center gap-1 hover:text-blue-500 transition-colors">
              <Share className="w-3 h-3" />
            </button>
          </div>

          {showReplyInput[`${postId}-${reply._id}`] && (
            <div className="mt-2 flex gap-2">
              <Avatar className="w-5 h-5">
                <AvatarFallback>
                  <User className="w-2 h-2" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Textarea
                  value={replyInputs[`${postId}-${reply._id}`] || ""}
                  onChange={(e) => setReplyInputs((prev) => ({ ...prev, [`${postId}-${reply._id}`]: e.target.value }))}
                  placeholder="Write a reply... (Use @gemini for AI response)"
                  className="min-h-[50px] text-xs border-none resize-none focus-visible:ring-0"
                  disabled={isReplying[`${postId}-${reply._id}`]}
                />
                <div className="flex justify-end gap-2 mt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleReplyInput(`${postId}-${reply._id}`)}
                    disabled={isReplying[`${postId}-${reply._id}`]}
                    className="h-6 px-2 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleReply(postId, reply._id)}
                    disabled={!replyInputs[`${postId}-${reply._id}`]?.trim() || isReplying[`${postId}-${reply._id}`]}
                    className="rounded-full px-3 h-6 text-xs"
                  >
                    {isReplying[`${postId}-${reply._id}`] ? "Replying..." : "Reply"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {reply.comments && reply.comments.length > 0 && (
            <div className="mt-3 space-y-3">{renderReplies(reply.comments, postId, depth + 1)}</div>
          )}
        </div>
      </div>
    ))
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto border-x border-border min-h-screen">
        {/* Header */}
        <div className="sticky top-0 bg-background/80 backdrop-blur border-b border-border p-4">
          <h1 className="text-xl font-bold">Home</h1>
        </div>

        {/* Post Creation */}
        <div className="border-b border-border p-4">
          <div className="flex gap-3">
            <Avatar>
              <AvatarFallback>
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="What's happening? (Use @gemini to get AI responses)"
                className="min-h-[100px] border-none resize-none text-lg placeholder:text-muted-foreground focus-visible:ring-0"
                disabled={isPosting}
              />
              <div className="flex justify-between items-center mt-3">
                <p className="text-sm text-muted-foreground">Tip: Use @gemini, #ai, or #help to get AI responses</p>
                <Button onClick={handlePost} disabled={!newPost.trim() || isPosting} className="rounded-full px-6">
                  {isPosting ? "Posting..." : "Post"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Feed */}
        <ScrollArea className="flex-1">
          {posts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Your feed is empty. Create your first post!</p>
            </div>
          )}

          {posts.map((post) => (
            <div key={post._id} className="border-b border-border p-4 hover:bg-muted/50 transition-colors">
              <div className="flex gap-3">
                <Avatar>
                  <AvatarFallback className={post.authorId?.username === "gemini" ? "bg-blue-100" : "bg-gray-100" }>
                    {post.authorId?.username === "gemini" ? (
                      <Bot className="w-4 h-4 text-blue-600" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{post.authorId?.username}</span>
                    {post.authorId?.username === "gemini" && (
                      <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <Bot className="w-2 h-2 text-white" />
                      </div>
                    )}
                    <span className="text-muted-foreground text-sm">{formatTime(post.timestamp)}</span>
                  </div>

                  <p className="text-foreground mb-3 whitespace-pre-wrap leading-relaxed">{post.content}</p>

                  {/* Post Actions */}
                  <div className="flex items-center gap-6 text-muted-foreground">
                    <button
                      onClick={() => toggleReplyInput(post._id)}
                      className="flex items-center gap-2 hover:text-blue-500 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span className="text-sm">{post.comments?.length}</span>
                    </button>

                    <button className="flex items-center gap-2 hover:text-green-500 transition-colors">
                      <Repeat2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => toggleLike(post._id)}
                      className={`flex items-center gap-2 transition-colors ${
                        likedPosts.has(post._id) ? "text-red-500" : "hover:text-red-500"
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${likedPosts.has(post._id) ? "fill-current" : ""}`} />
                      <span className="text-sm">{post.likeCount}</span>
                    </button>

                    <button className="flex items-center gap-2 hover:text-blue-500 transition-colors">
                      <Share className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Reply Input Section */}
                  {showReplyInput[post._id] && (
                    <div className="mt-4 flex gap-3">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback>
                          <User className="w-3 h-3" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <Textarea
                          value={replyInputs[post._id] || ""}
                          onChange={(e) => setReplyInputs((prev) => ({ ...prev, [post._id]: e.target.value }))}
                          placeholder="Write a reply... (Use @gemini for AI response)"
                          className="min-h-[60px] text-sm border-none resize-none focus-visible:ring-0"
                          disabled={isReplying[post._id]}
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleReplyInput(post._id)}
                            disabled={isReplying[post._id]}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleReply(post._id)}
                            disabled={!replyInputs[post._id]?.trim() || isReplying[post._id]}
                            className="rounded-full px-4"
                          >
                            {isReplying[post._id] ? "Replying..." : "Reply"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {post.comments?.length > 0 && (
                    <div className="mt-4 space-y-3">{renderReplies(buildCommentTree(post.comments), post._id)}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </ScrollArea>
      </div>
    </div>
  )
}
