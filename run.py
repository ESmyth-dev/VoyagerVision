from voyager import Voyager
import os


# You can also use mc_port instead of azure_login, but azure_login is highly recommended
openai_api_key = os.getenv('openai_api_key')
voyager = Voyager(
    mc_port=65535,
    openai_api_key=openai_api_key,
)

# start lifelong learning
voyager.learn()