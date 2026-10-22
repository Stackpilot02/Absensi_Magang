# Schema
## users
id,name,email,username,password,role,mentor_id
index: unique(email), unique(username)
## attendance
id,user_id,date,check_in,check_out,latitude_in,longitude_in,latitude_out,longitude_out,status
## office_location
id,name,latitude,longitude,radius

## leave_request
id,user_id,type,start_date,end_date,reason,status,reviewer_id,reviewed_at,review_note

## activity_report
id,user_id,date,time,description,created_at,updated_at
index: (user_id, date), (date)

## audit_log
id,user_id,action,entity,entity_id,method,path,ip,user_agent,metadata,created_at
