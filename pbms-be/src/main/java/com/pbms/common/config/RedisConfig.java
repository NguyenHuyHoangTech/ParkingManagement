package com.pbms.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import com.fasterxml.jackson.databind.ObjectMapper;

// @Configuration
public class RedisConfig {

    @Bean
    @SuppressWarnings("deprecation")
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        
        // Use String serialization for keys
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());
        mapper.activateDefaultTyping(
            com.fasterxml.jackson.databind.jsontype.BasicPolymorphicTypeValidator.builder()
                .allowIfBaseType(Object.class).build(), 
            ObjectMapper.DefaultTyping.NON_FINAL
        );
        org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer<Object> serializer = new org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer<>(mapper, Object.class);
        
        // Use JSON serialization for values
        template.setValueSerializer(serializer);
        template.setHashValueSerializer(serializer);
        
        template.afterPropertiesSet();
        return template;
    }
}

