from voyager import Voyager
from dotenv import load_dotenv
import os

load_dotenv()
# You can also use mc_port instead of azure_login, but azure_login is highly recommended
openai_api_key = os.getenv('openai_api_key')
voyager = Voyager(
    mc_port=51219,
    openai_api_key=openai_api_key,
    resume=True
)

# start lifelong learning
voyager.learn()