from voyager import Voyager
from dotenv import load_dotenv
import os

load_dotenv()
# You can also use mc_port instead of azure_login, but azure_login is highly recommended
openai_api_key = os.getenv('openai_api_key')
voyager = Voyager(
    mc_port=53260,
    openai_api_key=openai_api_key,
    log_to_file=True
)

# start lifelong learning
voyager.learn()