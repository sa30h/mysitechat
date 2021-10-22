from django.urls import path
from .views import peer1, peer2, peer,index

# urlpatterns = [
#     path('', peer, name='peer'),
#     path('peer1/', peer1, name='peer1'),
#     path('peer2/', peer2, name='peer2'),
# ]

urlpatterns = [
    path('',index,name='index'),
    path('chat/<str:room_name>/',peer, name='room'),
    path('peer1/', peer1, name='peer1'),
    path('peer2/', peer2, name='peer2')

]