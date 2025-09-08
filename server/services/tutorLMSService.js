const axios = require('axios');

require('dotenv').config();

class TutorLMSService {
  constructor() {
    this.baseUrl = process.env.WORDPRESS_URL;
    this.apiVersion = 'v1';
    this.authToken = null;
  }

  /**
   * Set authentication token for API requests
   */
  setAuthToken(token) {
    this.authToken = token;
  }

  /**
   * Test connection to WordPress API
   */
  async testConnection() {
    try {
      const response = await this.apiRequest('/wp-json/');
      return { success: true, data: response };
    } catch (error) {
      console.error('WordPress connection test failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Make authenticated API request to WordPress
   */
  async apiRequest(endpoint, options = {}) {
    try {
      const config = {
        method: 'GET',
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
          ...options.headers,
        },
        ...options,
      };

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('Tutor LMS API request failed:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Tutor LMS API request failed');
    }
  }

  // ==================== Native Tutor LMS API Methods ====================

  /**
   * Get all courses with optional filtering
   */
  async getCourses(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const endpoint = `/wp-json/tutor/v1/courses${queryParams ? `?${queryParams}` : ''}`;
    return this.apiRequest(endpoint);
  }

  /**
   * Get complete course details with all content in one API call
   * Includes: course info, topics, lessons, enrollment status, user progress
   */
  async getCourseDetailsComplete(courseId, userId = null) {
    try {
      console.log(`Getting complete course data for course ${courseId}${userId ? ` for user ${userId}` : ''}`);
      
      // Get basic course details from native Tutor API
      const courseResponse = await this.apiRequest(`/wp-json/tutor/v1/courses/${courseId}`);
      
      if (!courseResponse || !courseResponse.id) {
        return {
          success: false,
          message: 'Course not found',
          error: 'Course not found'
        };
      }
      
      // Get course topics and lessons using native Tutor API
      const topicsResult = await this.getCourseTopics(courseId, userId);
      const topics = topicsResult.success ? topicsResult.data : [];
      
      // Get enrollment status if user is provided
      let enrollmentStatus = null;
      let userProgress = null;
      
      if (userId) {
        try {
          // Check enrollment status using native Tutor API
          const enrollmentResponse = await this.apiRequest(`/wp-json/tutor/v1/students/${userId}/courses`);
          const userCourses = Array.isArray(enrollmentResponse) ? enrollmentResponse : [];
          const enrollment = userCourses.find(course => course.id === parseInt(courseId));
          
          enrollmentStatus = {
            is_enrolled: !!enrollment,
            enrollment_date: enrollment?.enrollment_date || null,
            completion_date: enrollment?.completion_date || null,
            progress_percentage: enrollment?.progress_percentage || 0
          };
          
          // Get detailed progress if enrolled
          if (enrollment) {
            try {
              const progressResponse = await this.apiRequest(`/wp-json/tutor/v1/students/${userId}/courses/${courseId}/progress`);
              userProgress = progressResponse || null;
            } catch (progressError) {
              console.log('Failed to get user progress:', progressError.message);
            }
          }
        } catch (enrollmentError) {
          console.log('Failed to get enrollment status:', enrollmentError.message);
        }
      }
      
      // Calculate course statistics from topics
      let totalLessons = 0;
      let totalDuration = 0;
      topics.forEach(topic => {
        if (topic.lessons && Array.isArray(topic.lessons)) {
          totalLessons += topic.lessons.length;
          topic.lessons.forEach(lesson => {
            if (lesson.duration) {
              // Convert duration string to minutes
              const durationParts = lesson.duration.split(':');
              if (durationParts.length >= 2) {
                totalDuration += parseInt(durationParts[0]) * 60 + parseInt(durationParts[1]);
              }
            }
          });
        }
      });
      
      // Construct complete course data
      const completeData = {
        id: courseResponse.id,
        title: courseResponse.title || courseResponse.post_title,
        content: courseResponse.content || courseResponse.post_content,
        excerpt: courseResponse.excerpt || courseResponse.post_excerpt,
        image: courseResponse.image || courseResponse.featured_image,
        thumbnail: courseResponse.thumbnail || courseResponse.featured_image,
        permalink: courseResponse.permalink || courseResponse.link,
        price: courseResponse.price || 0,
        sale_price: courseResponse.sale_price || null,
        is_free: courseResponse.is_free || (courseResponse.price === 0),
        difficulty_level: courseResponse.difficulty_level || 'beginner',
        course_duration: courseResponse.course_duration || `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m`,
        total_lessons: totalLessons || courseResponse.total_lessons || 0,
        total_topics: topics.length,
        enrollment_count: courseResponse.enrollment_count || 0,
        rating: courseResponse.rating || 0,
        rating_count: courseResponse.rating_count || 0,
        instructor: courseResponse.instructor || null,
        category: courseResponse.category || null,
        tags: courseResponse.tags || [],
        topics: topics,
        curriculum: {
          topics: topics,
          statistics: {
            total_topics: topics.length,
            total_lessons: totalLessons,
            total_duration_minutes: totalDuration
          }
        },
        enrollment: enrollmentStatus || {
          is_enrolled: false,
          enrollment_date: null,
          completion_percentage: 0,
          can_enroll: true,
          enrollment_status: 'not_enrolled',
        },
        user_progress: userProgress,
        meta_data: courseResponse.meta_data || {},
        created_at: courseResponse.created_at || courseResponse.post_date,
        updated_at: courseResponse.updated_at || courseResponse.post_modified,
        content_loaded: true,
        has_content: topics.length > 0 || totalLessons > 0
      };
      
      console.log(`Successfully retrieved complete course data for ${courseId}: ${topics.length} topics, ${totalLessons} lessons`);
      return {
        success: true,
        data: completeData,
        message: 'Course details retrieved successfully from native Tutor API'
      };
      
    } catch (error) {
      console.error(`Failed to get complete course details for ${courseId}:`, error.message);
      return {
        success: false,
        message: `Failed to get course ${courseId}: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Get course by ID with complete content (topics + lessons) - Now uses complete endpoint
   */
  async getCourseById(courseId, userId = null) {
    const result = await this.getCourseDetailsComplete(courseId, userId);
    
    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.message || 'Failed to get course details');
    }
  }

  /**
   * Get course topics using native Tutor LMS API directly
   */
  async getCourseTopics(courseId, userId = null) {
    try {
      console.log(`Getting topics for course ${courseId} using native Tutor LMS API`);
      
      // Use native Tutor LMS topics API endpoint
      const params = new URLSearchParams({ course_id: courseId });
      const endpoint = `/wp-json/tutor/v1/topics?${params.toString()}`;
      
      try {
        const topicsResponse = await this.apiRequest(endpoint);
        console.log(`Native Tutor API topics response for course ${courseId}:`, JSON.stringify(topicsResponse, null, 2));
        
        if (Array.isArray(topicsResponse) && topicsResponse.length > 0) {
          console.log(`Found ${topicsResponse.length} topics from native Tutor API for course ${courseId}`);
          
          // Get lessons for each topic
          const topicsWithLessons = await Promise.all(
            topicsResponse.map(async (topic) => {
              try {
                const lessonsParams = new URLSearchParams({ topic_id: topic.id });
                const lessonsEndpoint = `/wp-json/tutor/v1/lessons?${lessonsParams.toString()}`;
                const lessonsResponse = await this.apiRequest(lessonsEndpoint);
                
                const lessons = Array.isArray(lessonsResponse) ? lessonsResponse : [];
                console.log(`Topic ${topic.id} has ${lessons.length} lessons`);
                
                return {
                  ID: topic.id,
                  post_title: topic.title || topic.post_title,
                  post_content: topic.content || topic.post_content || '',
                  post_excerpt: topic.excerpt || topic.post_excerpt || '',
                  menu_order: topic.menu_order || 0,
                  course_id: courseId,
                  lessons: lessons.map(lesson => ({
                    ID: lesson.id,
                    post_title: lesson.title || lesson.post_title,
                    post_content: lesson.content || lesson.post_content || '',
                    post_excerpt: lesson.excerpt || lesson.post_excerpt || '',
                    menu_order: lesson.menu_order || 0,
                    duration: lesson.duration || '15:00',
                    is_preview: lesson.is_preview || false,
                    is_completed: lesson.is_completed || false,
                    can_access: lesson.can_access !== false,
                    video_url: lesson.video_url || null,
                    lesson_type: lesson.lesson_type || 'video',
                    topic_id: topic.id,
                    course_id: courseId
                  }))
                };
              } catch (lessonsError) {
                console.warn(`Failed to get lessons for topic ${topic.id}:`, lessonsError.message);
                return {
                  ID: topic.id,
                  post_title: topic.title || topic.post_title,
                  post_content: topic.content || topic.post_content || '',
                  post_excerpt: topic.excerpt || topic.post_excerpt || '',
                  menu_order: topic.menu_order || 0,
                  course_id: courseId,
                  lessons: []
                };
              }
            })
          );
          
          return {
            success: true,
            data: topicsWithLessons,
            total: topicsWithLessons.length,
            message: 'Course topics retrieved successfully from native Tutor API'
          };
        }
        
        // If no topics found, check for direct lessons under course
        console.log(`No topics found for course ${courseId}, checking for direct lessons`);
        const directLessonsParams = new URLSearchParams({ course_id: courseId });
        const directLessonsEndpoint = `/wp-json/tutor/v1/lessons?${directLessonsParams.toString()}`;
        
        try {
          const directLessonsResponse = await this.apiRequest(directLessonsEndpoint);
          const directLessons = Array.isArray(directLessonsResponse) ? directLessonsResponse : [];
          
          if (directLessons.length > 0) {
            console.log(`Found ${directLessons.length} direct lessons for course ${courseId}, creating virtual topic`);
            
            // Create a virtual topic containing all direct lessons
            const virtualTopic = {
              ID: `virtual_topic_${courseId}`,
              post_title: `Course ${courseId} Content`,
              post_content: 'Course lessons',
              post_excerpt: 'All course lessons',
              menu_order: 1,
              course_id: courseId,
              lessons: directLessons.map(lesson => ({
                ID: lesson.id,
                post_title: lesson.title || lesson.post_title,
                post_content: lesson.content || lesson.post_content || '',
                post_excerpt: lesson.excerpt || lesson.post_excerpt || '',
                menu_order: lesson.menu_order || 0,
                duration: lesson.duration || '15:00',
                is_preview: lesson.is_preview || false,
                is_completed: lesson.is_completed || false,
                can_access: lesson.can_access !== false,
                video_url: lesson.video_url || null,
                lesson_type: lesson.lesson_type || 'video',
                topic_id: `virtual_topic_${courseId}`,
                course_id: courseId
              }))
            };
            
            return {
              success: true,
              data: [virtualTopic],
              total: 1,
              message: 'Course lessons organized into virtual topic'
            };
          }
        } catch (directLessonsError) {
          console.log(`Failed to get direct lessons: ${directLessonsError.message}`);
        }
        
        console.log(`No topics or lessons found for course ${courseId} using native API`);
        return {
          success: true,
          data: [],
          total: 0,
          message: 'No topics found for this course'
        };
        
      } catch (nativeApiError) {
        console.log(`Native Tutor API failed for course ${courseId}: ${nativeApiError.message}`);
        throw nativeApiError;
      }
      
    } catch (error) {
      console.error(`Failed to get topics for course ${courseId}:`, error.message);
      // Return empty array instead of throwing to prevent app crashes
      return {
        success: false,
        data: [],
        total: 0,
        error: error.message,
        message: 'Failed to retrieve course topics from native API'
      };
    }
  }

  /**
   * Get topics only using custom endpoint that mimics native API (solves permission issues)
   */
  async getTopicsOnly(courseId) {
    try {
      console.log(`Fetching topics only for course ${courseId}`);
      
      // Use our custom working endpoint directly
      console.log(`DEBUG: Using custom course curriculum endpoint...`);
      const endpoint = `/wp-json/education/v1/courses/${courseId}/topics`;
      const result = await this.apiRequest(endpoint);
      
      console.log(`Custom endpoint result:`, result);
      
      if (result && result.success && Array.isArray(result.data)) {
        const topics = result.data.map(topic => ({
          ID: topic.id,
          id: topic.id,
          post_title: topic.title,
          title: topic.title,
          post_content: topic.description || '',
          content: topic.description || '',
          post_excerpt: topic.excerpt || '',
          excerpt: topic.excerpt || '',
          post_type: 'topics',
          post_status: 'publish',
          course_id: courseId,
          topic_order: topic.order || 0,
          total_lessons: topic.lessons ? topic.lessons.length : 0,
          total_quizzes: topic.quizzes ? topic.quizzes.length : 0,
          total_assignments: topic.assignments ? topic.assignments.length : 0,
          // Include the actual lessons, quizzes, and assignments arrays
          lessons: topic.lessons || [],
          quizzes: topic.quizzes || [],
          assignments: topic.assignments || [],
        }));
        
        console.log(`DEBUG: Extracted ${topics.length} topics from custom endpoint`);
        
        return {
          success: true,
          data: topics,
          total: topics.length,
          message: 'Course topics retrieved successfully from custom endpoint',
        };
      } else if (Array.isArray(result)) {
        // Direct array response
        console.log(`DEBUG: Got direct array response with ${result.length} topics`);
        
        return {
          success: true,
          data: result,
          total: result.length,
          message: 'Course topics retrieved successfully from custom endpoint (direct)',
        };
      }
      
      return {
        success: true,
        data: [],
        total: 0,
        message: 'No topics found for this course',
      };
    } catch (error) {
      console.error('Failed to get course topics:', error);
      return {
        success: false,
        message: 'Failed to retrieve course topics',
        error: error.message,
        data: [],
        total: 0,
      };
    }
  }

  /**
   * Get lessons for a specific topic using custom endpoint that mimics native API
   */
  async getLessonsByTopic(topicId) {
    try {
      console.log(`Fetching lessons for topic ${topicId}`);
      
      // Use our custom endpoint that mimics native Tutor LMS API structure
      // This endpoint returns the same data format as /wp-json/tutor/v1/lessons
      const params = new URLSearchParams({ topic_id: topicId });
      const endpoint = `/wp-json/tutor/v1/lessons?${params.toString()}`;
      const result = await this.apiRequest(endpoint);
      
      console.log(`Lessons result for topic ${topicId}:`, result);
      
      if (Array.isArray(result)) {
        return {
          success: true,
          data: result,
          total: result.length,
          message: 'Topic lessons retrieved successfully from native-like API',
        };
      }
      
      return {
        success: true,
        data: [],
        total: 0,
        message: 'No lessons found for this topic',
      };
    } catch (error) {
      console.error('Failed to get topic lessons:', error);
      return {
        success: false,
        message: 'Failed to retrieve topic lessons',
        error: error.message,
        data: [],
        total: 0,
      };
    }
  }

  /**
   * Get course content structure using custom endpoint that mimics native API
   */
  async getCourseContentStructure(courseId) {
    try {
      console.log(`Fetching course content structure for course ${courseId}`);
      
      // Use our custom endpoint that mimics native Tutor LMS API structure
      // This endpoint returns the same data format as /wp-json/tutor/v1/course-contents/{id}
      const endpoint = `/wp-json/tutor/v1/course-contents/${courseId}`;
      const result = await this.apiRequest(endpoint);
      
      console.log(`Course content structure result:`, result);
      
      if (result) {
        return {
          success: true,
          data: result,
          message: 'Course content structure retrieved successfully from native-like API',
        };
      }
      
      return {
        success: false,
        data: null,
        message: 'No course content structure found',
      };
    } catch (error) {
      console.error('Failed to get course content structure:', error);
      return {
        success: false,
        message: 'Failed to retrieve course content structure',
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Get specific lesson by ID using custom endpoint that mimics native API
   */
  async getLessonDetailsById(lessonId, userId = null) {
    try {
      console.log(`Fetching lesson details for lesson ${lessonId}`);
      
      // Use our custom endpoint that mimics native Tutor LMS API structure
      // This endpoint returns the same data format as /wp-json/tutor/v1/lessons/{id}
      const endpoint = `/wp-json/tutor/v1/lessons/${lessonId}`;
      const result = await this.apiRequest(endpoint);
      
      console.log(`Lesson details result:`, result);
      
      if (result) {
        return {
          success: true,
          data: result,
          message: 'Lesson details retrieved successfully from native-like API',
        };
      }
      
      return {
        success: false,
        data: null,
        message: 'Lesson not found',
      };
    } catch (error) {
      console.error('Failed to get lesson details:', error);
      return {
        success: false,
        message: 'Failed to retrieve lesson details',
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Mark lesson as complete
   */
  async markLessonComplete(lessonId, userId = null) {
    try {
      console.log(`Marking lesson ${lessonId} as complete for user ${userId}`);
      
      // Use our custom WordPress REST API endpoint to mark lesson as complete
      const endpoint = `/wp-json/education/v1/lessons/${lessonId}/complete`;
      const result = await this.apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
        }),
      });
      
      console.log(`Mark lesson complete result:`, result);
      
      if (result && result.success) {
        return {
          success: true,
          data: result.data,
          message: 'Lesson marked as complete successfully',
        };
      }
      
      return {
        success: false,
        data: null,
        message: result?.message || 'Failed to mark lesson as complete',
      };
    } catch (error) {
      console.error('Failed to mark lesson as complete:', error);
      return {
        success: false,
        message: 'Failed to mark lesson as complete',
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Get lesson progress for user
   */
  async getLessonProgress(lessonId, userId = null) {
    try {
      console.log(`Getting lesson progress for lesson ${lessonId}, user ${userId}`);
      
      // Use WordPress REST API to get lesson progress
      const endpoint = `/wp-json/education/v1/lessons/${lessonId}/progress`;
      const result = await this.apiRequest(endpoint, {
        method: 'GET',
        query: { user_id: userId },
      });
      
      console.log(`Lesson progress result:`, result);
      
      if (result && result.success) {
        return {
          success: true,
          data: result.data,
          message: 'Lesson progress retrieved successfully',
        };
      }
      
      return {
        success: false,
        data: null,
        message: result?.message || 'Lesson progress not found',
      };
    } catch (error) {
      console.error('Failed to get lesson progress:', error);
      return {
        success: false,
        message: 'Failed to get lesson progress',
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Check user enrollment status for a course
   */
  async checkEnrollmentStatus(courseId, userId = null) {
    try {
      // If no userId provided, try to get from current user context
      if (!userId) {
        console.log('No userId provided for enrollment check');
        return {
          success: false,
          message: 'User ID required for enrollment check',
          error: 'Missing user ID'
        };
      }
      
      const endpoint = `/wp-json/education/v1/courses/${courseId}/enrollment-status`;
      const response = await this.apiRequest(endpoint);
      
      if (response && response.success && response.data) {
        return {
          success: true,
          data: response.data,
          message: response.message || 'Enrollment status retrieved successfully'
        };
      }
      
      return {
        success: false,
        message: response?.message || 'Failed to check enrollment status',
        error: 'Invalid response format'
      };
    } catch (error) {
      console.error('Check enrollment status error:', error);
      return {
        success: false,
        message: 'Failed to check enrollment status',
        error: error.message
      };
    }
  }

  /**
   * Enroll user in a course
   */
  async enrollInCourse(courseId, userId = null) {
    try {
      const endpoint = `/wp-json/education/v1/courses/${courseId}/enroll`;
      const response = await this.apiRequest(endpoint, { method: 'POST' });
      
      if (response && response.success) {
        return {
          success: true,
          data: response.data,
          message: response.message || 'Successfully enrolled in course'
        };
      }
      
      return {
        success: false,
        message: response?.message || 'Failed to enroll in course',
        error: 'Enrollment failed'
      };
    } catch (error) {
      console.error('Enroll in course error:', error);
      return {
        success: false,
        message: 'Failed to enroll in course',
        error: error.message
      };
    }
  }

  /**
   * Unenroll user from a course
   */
  async unenrollFromCourse(courseId, userId = null) {
    try {
      const endpoint = `/wp-json/education/v1/courses/${courseId}/unenroll`;
      const response = await this.apiRequest(endpoint, { method: 'POST' });
      
      if (response && response.success) {
        return {
          success: true,
          data: response.data,
          message: response.message || 'Successfully unenrolled from course'
        };
      }
      
      return {
        success: false,
        message: response?.message || 'Failed to unenroll from course',
        error: 'Unenrollment failed'
      };
    } catch (error) {
      console.error('Unenroll from course error:', error);
      return {
        success: false,
        message: 'Failed to unenroll from course',
        error: error.message
      };
    }
  }

  /**
   * Get specific lesson by ID
   */
  async getLessonById(lessonId) {
    return this.apiRequest(`/wp-json/tutor/v1/lesson/${lessonId}`);
  }

  /**
   * Get course ratings
   */
  async getCourseRating(courseId) {
    return this.apiRequest(`/wp-json/tutor/v1/course-rating/${courseId}`);
  }

  /**
   * Get course reviews
   */
  async getCourseReviews(courseId, params = {}) {
    const queryParams = new URLSearchParams({ course_id: courseId, ...params }).toString();
    return this.apiRequest(`/wp-json/tutor/v1/reviews?${queryParams}`);
  }

  /**
   * Create course enrollment
   */
  async createEnrollment(userId, courseId) {
    return this.apiRequest('/wp-json/tutor/v1/enrollment', {
      method: 'POST',
      data: {
        user_id: userId,
        course_id: courseId,
      },
    });
  }

  /**
   * Get user enrollments
   */
  async getUserEnrollments(userId) {
    return this.apiRequest(`/wp-json/tutor/v1/students/${userId}/courses`);
  }

  /**
   * Get all enrollments (admin)
   */
  async getAllEnrollments(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    return this.apiRequest(`/wp-json/tutor/v1/enrollments${queryParams ? `?${queryParams}` : ''}`);
  }

  /**
   * Get course Q&A
   */
  async getCourseQA(courseId, userId = null) {
    const params = { course_id: courseId };
    if (userId) params.user_id = userId;
    const queryParams = new URLSearchParams(params).toString();
    return this.apiRequest(`/wp-json/tutor/v1/qna?${queryParams}`);
  }

  /**
   * Post question in course Q&A
   */
  async postQuestion(courseId, userId, question) {
    return this.apiRequest('/wp-json/tutor/v1/qna', {
      method: 'POST',
      data: {
        course_id: courseId,
        user_id: userId,
        question: question,
      },
    });
  }

  /**
   * Post answer to Q&A question
   */
  async postAnswer(questionId, userId, answer) {
    return this.apiRequest('/wp-json/tutor/v1/qna', {
      method: 'POST',
      data: {
        parent_id: questionId,
        user_id: userId,
        answer: answer,
      },
    });
  }

  /**
   * Mark Q&A as read/unread
   */
  async markQAReadUnread(commentId, isRead = true) {
    return this.apiRequest(`/wp-json/tutor/v1/qna-mark-read-unread/${commentId}`, {
      method: 'POST',
      data: { is_read: isRead },
    });
  }

  /**
   * Get quiz by ID
   */
  async getQuizById(quizId) {
    return this.apiRequest(`/wp-json/tutor/v1/quiz/${quizId}`);
  }

  // ==================== Native WordPress Custom API Methods ====================

  /**
   * Test native WordPress API endpoint
   */
  async testNativeApi() {
    try {
      return this.apiRequest('/wp-json/education/v1/test');
    } catch (error) {
      console.error('Native API test failed:', error);
      throw error;
    }
  }

  /**
   * Get courses using native WordPress API
   */
  async getNativeCourses(params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const endpoint = `/wp-json/education/v1/courses/native${queryParams ? `?${queryParams}` : ''}`;
      return this.apiRequest(endpoint);
    } catch (error) {
      console.error('Failed to get native courses:', error);
      throw error;
    }
  }

  /**
   * Get categories using native WordPress API
   */
  async getNativeCategories() {
    try {
      return this.apiRequest('/wp-json/education/v1/categories');
    } catch (error) {
      console.error('Failed to get native categories:', error);
      throw error;
    }
  }

  /**
   * Get enhanced courses using native WordPress API
   */
  async getNativeEnhancedCourses(params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const endpoint = `/wp-json/education/v1/courses/enhanced-native${queryParams ? `?${queryParams}` : ''}`;
      return this.apiRequest(endpoint);
    } catch (error) {
      console.error('Failed to get native enhanced courses:', error);
      throw error;
    }
  }

  /**
   * Get course by ID using native WordPress API
   */
  async getNativeCourseById(courseId) {
    try {
      return this.apiRequest(`/wp-json/education/v1/courses/${courseId}`);
    } catch (error) {
      console.error(`Failed to get native course ${courseId}:`, error);
      throw error;
    }
  }

  /**
   * Get courses by category using native WordPress API
   */
  async getNativeCoursesByCategory(categoryId, params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const endpoint = `/wp-json/education/v1/courses/category/${categoryId}${queryParams ? `?${queryParams}` : ''}`;
      return this.apiRequest(endpoint);
    } catch (error) {
      console.error(`Failed to get native courses by category ${categoryId}:`, error);
      throw error;
    }
  }

  // ==================== Enhanced Methods with Custom Logic ====================

  /**
   * Get courses with enhanced metadata and organization
   */
  async getCoursesWithMetadata(filters = {}) {
    try {
      console.log('Getting courses with metadata from Tutor LMS API...');
      const courses = await this.getCourses();
      
      if (!courses || !courses.data) {
        console.log('No courses data received from API, returning empty result');
        return { data: [], pagination: null };
      }

      console.log(`Received ${courses.data.length} courses from Tutor LMS API`);
      
      const enhancedCourses = await Promise.all(
        courses.data.map(async (course) => {
          try {
            // Get course metadata
            const metadata = await this.getCourseMetadata(course.id);
            
            // Get course rating
            let rating = null;
            try {
              rating = await this.getCourseRating(course.id);
            } catch (error) {
              console.warn(`Failed to get rating for course ${course.id}:`, error.message);
            }

            return {
              ...course,
              metadata,
              rating: rating || { average: 0, count: 0 },
              enhanced: true,
            };
          } catch (error) {
            console.warn(`Failed to enhance course ${course.id}:`, error.message);
            return course;
          }
        })
      );

      // Apply filters
      const filteredCourses = this.applyFilters(enhancedCourses, filters);

      return {
        data: filteredCourses,
        pagination: courses.pagination,
        total: filteredCourses.length,
      };
    } catch (error) {
      console.error('Failed to get courses with metadata:', error.message);
      
      // Return empty result instead of throwing
      return { data: [], pagination: null, total: 0 };
    }
  }

  /**
   * Get course metadata using WordPress REST API (enhanced with our custom fields)
   */
  async getCourseMetadata(courseId) {
    try {
      // Use WordPress Posts API with custom meta fields
      const response = await this.apiRequest(`/wp-json/wp/v2/courses/${courseId}`, {
        params: { 
          _embed: true,
          _fields: 'id,title,content,excerpt,featured_media,meta,course_country,course_subject,course_grade,course_curriculum'
        },
      });
      
      // Extract custom metadata from response
      const metadata = {
        course_country: response.course_country || [],
        course_subject: response.course_subject || [],
        course_grade_level: response.course_grade || [],
        course_curriculum: response.course_curriculum || [],
        course_academic_year: response.meta?._course_academic_year || '',
        course_language: response.meta?._course_language || '',
        course_type: response.meta?._course_type || '',
        is_free_course: response.meta?._is_free_course === '1',
        bundle_id: response.meta?._course_bundle_id || '',
        bundle_name: response.meta?._course_bundle_name || '',
        bundle_courses: response.meta?._bundle_courses ? JSON.parse(response.meta._bundle_courses) : [],
        is_bundle_master: response.meta?._is_bundle_master === '1',
        woocommerce_product_id: response.meta?._woocommerce_product_id || '',
        live_meeting_room_id: response.meta?._live_meeting_room_id || '',
        live_session_schedule: response.meta?._live_session_schedule ? JSON.parse(response.meta._live_session_schedule) : null,
      };
      
      return metadata;
    } catch (error) {
      console.warn(`Failed to get metadata for course ${courseId}:`, error.message);
      return {};
    }
  }

  /**
   * Get courses by country using custom endpoint
   */
  /**
   * Get courses by country using custom endpoint
   */
  async getCoursesByCountry(country, additionalFilters = {}) {
    try {
      console.log(`Getting courses for country: ${country}`);
      
      // Try custom WordPress endpoint first
      try {
        const params = new URLSearchParams({
          ...additionalFilters,
        }).toString();
        
        const endpoint = `/wp-json/education/v1/curricula/${country}${params ? `?${params}` : ''}`;
        const response = await this.apiRequest(endpoint);
        
        if (response.success && response.data) {
          console.log(`WordPress custom API returned ${response.data.length} courses for ${country}`);
          return {
            data: response.data,
            pagination: response.pagination,
            total: response.pagination?.total || response.data.length,
          };
        }
      } catch (customEndpointError) {
        console.log(`Custom endpoint not available for ${country}, falling back to standard API`);
      }
      
      // Fallback to filtering all courses through standard Tutor LMS API
      const filters = { country, ...additionalFilters };
      return this.getCoursesWithMetadata(filters);
    } catch (error) {
      console.error(`Failed to get courses for country ${country}:`, error.message);
      
      // Return empty result instead of throwing
      return {
        data: [],
        pagination: null,
        total: 0,
      };
    }
  }

  /**
   * Get courses organized by subject
   */
  async getCoursesBySubject(subject, additionalFilters = {}) {
    const filters = { subject, ...additionalFilters };
    return this.getCoursesWithMetadata(filters);
  }

  /**
   * Get courses organized by grade level
   */
  async getCoursesByGradeLevel(gradeLevel, additionalFilters = {}) {
    const filters = { grade_level: gradeLevel, ...additionalFilters };
    return this.getCoursesWithMetadata(filters);
  }

  /**
   * Search courses with advanced filtering
   */
  async searchCourses(query, filters = {}, pagination = {}) {
    try {
      const searchParams = {
        search: query,
        ...filters,
        ...pagination,
      };

      const courses = await this.getCoursesWithMetadata(searchParams);
      
      return {
        ...courses,
        query,
        filters,
      };
    } catch (error) {
      console.error('Course search failed:', error);
      throw error;
    }
  }

  /**
   * Get course bundles using course metadata (no separate post type needed)
   */
  async getBundles(filters = {}) {
    try {
      // Use new clean WordPress API for real course bundles
      const params = new URLSearchParams(filters).toString();
      const endpoint = `/wp-json/education/v1/course-bundles${params ? `?${params}` : ''}`;
      const response = await this.apiRequest(endpoint);
      
      if (response.success && response.data) {
        return {
          data: response.data,
          pagination: response.pagination,
          total: response.pagination?.total || response.data.length,
        };
      }
      
      throw new Error(response.message || 'Failed to get course bundles');
    } catch (error) {
      console.error('Failed to get bundles:', error);
      return { data: [], pagination: null, total: 0 };
    }
  }

  /**
   * Get bundle by ID (using new clean WordPress API)
   */
  async getBundleById(bundleId) {
    try {
      const endpoint = `/wp-json/education/v1/course-bundles/${bundleId}`;
      const response = await this.apiRequest(endpoint);
      
      if (response.success && response.data) {
        return response.data;
      }
      
      throw new Error(response.message || 'Bundle not found');
    } catch (error) {
      console.error(`Failed to get bundle ${bundleId}:`, error);
      return null;
    }
  }

  /**
   * Check user's access to course/bundle using native Tutor LMS enrollment
   */
  async checkUserAccess(userId, itemType, itemId) {
    try {
      if (itemType === 'course') {
        // Use native Tutor LMS enrollment check
        const enrollments = await this.getUserEnrollments(userId);
        return enrollments.some(enrollment => enrollment.course_id === parseInt(itemId));
      }
      
      if (itemType === 'bundle') {
        // Get bundle courses and check enrollment for all
        const bundle = await this.getBundleById(itemId);
        if (!bundle || !bundle.courses) {
          return false;
        }
        
        const enrollments = await this.getUserEnrollments(userId);
        const enrolledCourseIds = enrollments.map(e => e.course_id);
        
        // Check if user is enrolled in all bundle courses
        return bundle.courses.every(course => 
          enrolledCourseIds.includes(parseInt(course.id))
        );
      }

      return false;
    } catch (error) {
      console.error('Access check failed:', error);
      return false;
    }
  }

  /**
   * Enroll user in bundle (enroll in all bundle courses)
   */
  async enrollUserInBundle(userId, bundleId) {
    try {
      const bundle = await this.getBundleById(bundleId);
      if (!bundle || !bundle.courses) {
        throw new Error('Bundle not found or has no courses');
      }
      
      const enrollmentResults = [];
      
      for (const course of bundle.courses) {
        try {
          const result = await this.createEnrollment(userId, course.id);
          enrollmentResults.push({
            courseId: course.id,
            courseName: course.title,
            success: true,
            enrollment: result
          });
        } catch (error) {
          console.error(`Failed to enroll user ${userId} in course ${course.id}:`, error);
          enrollmentResults.push({
            courseId: course.id,
            courseName: course.title,
            success: false,
            error: error.message
          });
        }
      }
      
      const successfulEnrollments = enrollmentResults.filter(r => r.success);
      const failedEnrollments = enrollmentResults.filter(r => !r.success);
      
      return {
        bundleId,
        userId,
        totalCourses: bundle.courses.length,
        successfulEnrollments: successfulEnrollments.length,
        failedEnrollments: failedEnrollments.length,
        details: enrollmentResults,
        success: failedEnrollments.length === 0
      };
    } catch (error) {
      console.error(`Failed to enroll user ${userId} in bundle ${bundleId}:`, error);
      throw error;
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Apply filters to courses array (enhanced with bundle filtering)
   */
  applyFilters(courses, filters) {
    let filtered = [...courses];

    if (filters.country) {
      filtered = filtered.filter(course => 
        course.metadata?.course_country?.includes(filters.country)
      );
    }

    if (filters.subject) {
      filtered = filtered.filter(course => 
        course.metadata?.course_subject?.includes(filters.subject)
      );
    }

    if (filters.grade_level) {
      filtered = filtered.filter(course => 
        course.metadata?.course_grade_level?.includes(filters.grade_level)
      );
    }

    if (filters.course_type) {
      filtered = filtered.filter(course => 
        course.metadata?.course_type === filters.course_type
      );
    }

    if (filters.is_free !== undefined) {
      filtered = filtered.filter(course => 
        Boolean(course.metadata?.is_free_course) === Boolean(filters.is_free)
      );
    }

    if (filters.bundle_id) {
      filtered = filtered.filter(course => 
        course.metadata?.bundle_id === filters.bundle_id
      );
    }

    if (filters.is_bundle_master !== undefined) {
      filtered = filtered.filter(course => 
        Boolean(course.metadata?.is_bundle_master) === Boolean(filters.is_bundle_master)
      );
    }

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(course => 
        course.title?.toLowerCase().includes(searchTerm) ||
        course.content?.toLowerCase().includes(searchTerm) ||
        course.excerpt?.toLowerCase().includes(searchTerm)
      );
    }

    return filtered;
  }

  /**
   * Calculate total duration for bundle courses
   */
  calculateBundleDuration(courses) {
    let totalMinutes = 0;
    
    courses.forEach(course => {
      if (course.metadata?.course_duration) {
        const duration = course.metadata.course_duration;
        totalMinutes += (parseInt(duration.hours) || 0) * 60 + (parseInt(duration.minutes) || 0);
      }
    });
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}:${minutes.toString().padStart(2, '0')}:00`;
  }

  /**
   * Organize courses by curriculum/country
   */
  organizeCoursesByCountry(courses) {
    const organized = {};
    
    courses.forEach(course => {
      // Extract country from taxonomies or metadata
      let country = 'other';
      
      if (course.metadata?.course_country && course.metadata.course_country.length > 0) {
        country = course.metadata.course_country[0].slug || course.metadata.course_country[0].name || course.metadata.course_country[0];
      }
      
      if (!organized[country]) {
        organized[country] = {
          country: this.formatCountryName(country),
          items: [],
          total: 0,
        };
      }
      
      // Format course data for mobile app
      const formattedCourse = this.formatCourseForMobile(course);
      organized[country].items.push(formattedCourse);
      organized[country].total++;
    });

    return Object.values(organized);
  }

  /**
   * Format course data for mobile app display
   */
  formatCourseForMobile(course) {
    // Extract metadata
    const metadata = course.metadata || {};
    const rating = course.rating || {};
    
    // Get subject and grade for title formatting
    const subject = this.extractSubjectFromCourse(course);
    const grade = this.extractGradeFromCourse(course);
    const author = this.extractAuthorFromCourse(course);
    
    return {
      id: course.id,
      title: this.formatCourseTitle(course.title?.rendered || course.post_title || course.title, subject, grade),
      author: author,
      rating: parseFloat(rating.average || rating.rating || 0),
      reviews: parseInt(rating.count || rating.reviews_count || 0),
      featured_image: this.getCourseFeaturedImage(course),
      course_country: metadata.course_country,
      course_subject: subject,
      course_grade: grade,
      price: this.getCoursePrice(course),
      enrolled_students: this.getCourseEnrollments(course),
    };
  }

  /**
   * Format course title to match design (Subject - Grade Level)
   */
  formatCourseTitle(originalTitle, subject, grade) {
    // If title already follows the pattern, return as is
    if (originalTitle.includes(' - Grade ') || originalTitle.includes(' - ')) {
      return originalTitle;
    }
    
    // Format as "Subject - Grade Level"
    const formattedSubject = this.formatSubjectName(subject);
    const formattedGrade = this.formatGradeName(grade);
    
    return `${formattedSubject} - ${formattedGrade}`;
  }

  /**
   * Extract subject from course data
   */
  extractSubjectFromCourse(course) {
    if (course.metadata?.course_subject && course.metadata.course_subject.length > 0) {
      return course.metadata.course_subject[0].slug || course.metadata.course_subject[0].name || course.metadata.course_subject[0];
    }
    
    // Try to extract from title
    const title = course.title?.rendered || course.post_title || course.title || '';
    if (title.toLowerCase().includes('math')) return 'mathematics';
    if (title.toLowerCase().includes('arabic')) return 'arabic';
    if (title.toLowerCase().includes('science')) return 'science';
    if (title.toLowerCase().includes('english')) return 'english';
    
    return 'general';
  }

  /**
   * Extract grade from course data
   */
  extractGradeFromCourse(course) {
    if (course.metadata?.course_grade_level && course.metadata.course_grade_level.length > 0) {
      return course.metadata.course_grade_level[0].slug || course.metadata.course_grade_level[0].name || course.metadata.course_grade_level[0];
    }
    
    if (course.metadata?.course_academic_year) {
      return course.metadata.course_academic_year;
    }
    
    // Try to extract from title
    const title = course.title?.rendered || course.post_title || course.title || '';
    const gradeMatch = title.match(/grade\s*(\d+)/i);
    if (gradeMatch) {
      return `grade-${gradeMatch[1]}`;
    }
    
    return 'grade-5';
  }

  /**
   * Extract author from course data
   */
  extractAuthorFromCourse(course) {
    if (course.author_name) {
      return course.author_name;
    }
    
    if (course.author && course.author.display_name) {
      return course.author.display_name;
    }

    // Extract from country for ministry attribution
    const country = this.extractCountryFromCourse(course);
    return `${this.formatCountryName(country)} Ministry`;
  }

  /**
   * Extract country from course data
   */
  extractCountryFromCourse(course) {
    if (course.metadata?.course_country && course.metadata.course_country.length > 0) {
      return course.metadata.course_country[0].slug || course.metadata.course_country[0].name || course.metadata.course_country[0];
    }
    return 'other';
  }

  /**
   * Get course featured image
   */
  getCourseFeaturedImage(course) {
    if (course.featured_media_url) {
      return course.featured_media_url;
    }
    
    if (course._embedded && course._embedded['wp:featuredmedia']) {
      return course._embedded['wp:featuredmedia'][0].source_url;
    }

    // Default images based on subject
    const subject = this.extractSubjectFromCourse(course);
    const imageMap = {
      mathematics: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=180&h=90&fit=crop',
      arabic: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=180&h=90&fit=crop',
      science: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=180&h=90&fit=crop',
      english: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=180&h=90&fit=crop',
    };

    return imageMap[subject] || 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=180&h=90&fit=crop';
  }

  /**
   * Get course price
   */
  getCoursePrice(course) {
    if (course.metadata?.is_free_course) {
      return 0;
    }
    
    if (course.price) {
      return parseFloat(course.price);
    }
    
    return 0; // Default to free
  }

  /**
   * Get course enrollments count
   */
  getCourseEnrollments(course) {
    if (course.enrolled_students) {
      return parseInt(course.enrolled_students);
    }
    
    if (course.students_count) {
      return parseInt(course.students_count);
    }
    
    // Return 0 if no enrollment data available
    return 0;
  }

  /**
   * Format subject name for display
   */
  formatSubjectName(subject) {
    const subjectMap = {
      'mathematics': 'Mathematics',
      'math': 'Mathematics', 
      'arabic': 'Arabic',
      'science': 'Science',
      'english': 'English',
      'history': 'History',
      'geography': 'Geography',
    };

    return subjectMap[subject] || subject.charAt(0).toUpperCase() + subject.slice(1);
  }

  /**
   * Format grade name for display
   */
  formatGradeName(grade) {
    if (grade.startsWith('grade-')) {
      const gradeNumber = grade.replace('grade-', '');
      return `Grade ${gradeNumber}`;
    }
    
    return grade.charAt(0).toUpperCase() + grade.slice(1);
  }

  /**
   * Format country name for display
   */
  formatCountryName(country) {
    const countryMap = {
      'egypt': 'Egypt',
      'sudan': 'Sudan',
      'qatar': 'Qatar',
      'uae': 'UAE',
      'saudi-arabia': 'Saudi Arabia',
      'kuwait': 'Kuwait',
      'bahrain': 'Bahrain',
      'oman': 'Oman',
      'other': 'General',
    };

    return countryMap[country] || country.charAt(0).toUpperCase() + country.slice(1);
  }

  /**
   * Organize courses by subject
   */
  organizeCoursesBySubject(courses) {
    const organized = {};
    
    courses.forEach(course => {
      const subject = course.metadata?.course_subject || 'other';
      if (!organized[subject]) {
        organized[subject] = {
          subject,
          courses: [],
          total: 0,
        };
      }
      organized[subject].courses.push(course);
      organized[subject].total++;
    });

    return Object.values(organized);
  }

  /**
   * Get curriculum structure with organized data
   */
  async getCurriculumStructure() {
    try {
      console.log('Getting curriculum structure...');
      
      // Use new clean WordPress API
      const response = await this.apiRequest('/wp-json/education/v1/curricula');
      
      if (response.success && response.data) {
        console.log('Clean WordPress API response received successfully');
        return response.data;
      }
      
      throw new Error(response.message || 'Failed to get curriculum structure');
    } catch (error) {
      console.error('Failed to get curriculum structure:', error.message);
      return [];
    }
  }

  /**
   * Get courses by country using custom endpoint
   */
  async getCoursesByCountry(country, additionalFilters = {}) {
    try {
      // Use custom WordPress endpoint
      const params = new URLSearchParams({
        ...additionalFilters,
      }).toString();
      
      const endpoint = `/wp-json/education/v1/curricula/${country}${params ? `?${params}` : ''}`;
      const response = await this.apiRequest(endpoint);
      
      if (response.success && response.data) {
        return {
          data: response.data,
          pagination: response.pagination,
          total: response.pagination?.total || response.data.length,
        };
      }
      
      throw new Error(response.message || 'Failed to get country courses');
    } catch (error) {
      console.error(`Failed to get courses for country ${country}:`, error);
      
      // Fallback to filtering all courses
      try {
        const filters = { country, ...additionalFilters };
        return this.getCoursesWithMetadata(filters);
      } catch (fallbackError) {
        console.error('Fallback failed:', fallbackError);
        throw new Error(`Failed to get courses for country ${country}`);
      }
    }
  }

  /**
   * Get complete course details with all content, enrollment status, and user progress
   * This is the comprehensive endpoint for course details screen
   */
  async getCourseDetailsComplete(courseId, userId = null) {
    try {
      console.log(`Getting complete course details for course ${courseId}${userId ? ` for user ${userId}` : ''}`);
      
      // Try native WordPress API first
      try {
        const nativeEndpoint = `/wp-json/education/v1/courses/${courseId}`;
        const nativeParams = userId ? `?user_id=${userId}` : '';
        
        console.log(`Trying native API: ${nativeEndpoint}${nativeParams}`);
        
        const nativeResponse = await this.apiRequest(`${nativeEndpoint}${nativeParams}`);
        
        if (nativeResponse && nativeResponse.success) {
          console.log('Native API returned course details successfully');
          return {
            success: true,
            data: nativeResponse.data,
            message: 'Complete course details retrieved via native API'
          };
        }
      } catch (nativeError) {
        console.log('Native API failed, falling back to standard Tutor LMS API');
      }
      
      // Fallback to standard Tutor LMS API with manual aggregation
      console.log('Using fallback standard Tutor LMS API');
      
      // Get basic course details
      const courseResponse = await this.apiRequest(`/wp-json/tutor/v1/courses/${courseId}`);
      
      if (!courseResponse || !courseResponse.id) {
        return {
          success: false,
          message: 'Course not found',
          error: 'Course not found'
        };
      }
      
      // Get course curriculum/topics
      let curriculum = [];
      try {
        const topicsResponse = await this.apiRequest(`/wp-json/tutor/v1/courses/${courseId}/topics`);
        curriculum = Array.isArray(topicsResponse) ? topicsResponse : [];
      } catch (topicsError) {
        console.log('Failed to get course topics:', topicsError.message);
      }
      
      // Get enrollment status if user is provided
      let enrollmentStatus = null;
      let userProgress = null;
      
      if (userId) {
        try {
          // Check enrollment status
          const enrollmentResponse = await this.apiRequest(`/wp-json/tutor/v1/students/${userId}/courses`);
          const userCourses = Array.isArray(enrollmentResponse) ? enrollmentResponse : [];
          const enrollment = userCourses.find(course => course.id === parseInt(courseId));
          
          enrollmentStatus = {
            is_enrolled: !!enrollment,
            enrollment_date: enrollment?.enrollment_date || null,
            completion_date: enrollment?.completion_date || null,
            progress_percentage: enrollment?.progress_percentage || 0
          };
          
          // Get detailed progress if enrolled
          if (enrollment) {
            try {
              const progressResponse = await this.apiRequest(`/wp-json/tutor/v1/students/${userId}/courses/${courseId}/progress`);
              userProgress = progressResponse || null;
            } catch (progressError) {
              console.log('Failed to get user progress:', progressError.message);
            }
          }
        } catch (enrollmentError) {
          console.log('Failed to get enrollment status:', enrollmentError.message);
        }
      }
      
      // Construct complete course data
      const completeData = {
        id: courseResponse.id,
        title: courseResponse.title || courseResponse.post_title,
        content: courseResponse.content || courseResponse.post_content,
        excerpt: courseResponse.excerpt || courseResponse.post_excerpt,
        image: courseResponse.image || courseResponse.featured_image,
        thumbnail: courseResponse.thumbnail || courseResponse.featured_image,
        permalink: courseResponse.permalink || courseResponse.link,
        price: courseResponse.price || 0,
        sale_price: courseResponse.sale_price || null,
        is_free: courseResponse.is_free || (courseResponse.price === 0),
        difficulty_level: courseResponse.difficulty_level || 'beginner',
        course_duration: courseResponse.course_duration || '',
        total_lessons: courseResponse.total_lessons || curriculum.length,
        enrollment_count: courseResponse.enrollment_count || 0,
        rating: courseResponse.rating || 0,
        rating_count: courseResponse.rating_count || 0,
        instructor: courseResponse.instructor || null,
        category: courseResponse.category || null,
        tags: courseResponse.tags || [],
        curriculum: curriculum,
        enrollment_status: enrollmentStatus,
        user_progress: userProgress,
        meta_data: courseResponse.meta_data || {},
        created_at: courseResponse.created_at || courseResponse.post_date,
        updated_at: courseResponse.updated_at || courseResponse.post_modified
      };
      
      return {
        success: true,
        data: completeData,
        message: 'Complete course details retrieved via fallback API'
      };
      
    } catch (error) {
      console.error('Failed to get complete course details:', error);
      return {
        success: false,
        message: 'Failed to retrieve complete course details',
        error: error.message
      };
    }
  }
}

module.exports = TutorLMSService;
